/**
 * 크로싱 방문 순서 + 2D 평면 좌표로부터 부드러운 3D 매듭 곡선을 만든다.
 *
 * 같은 크로싱을 두 번 지나가는 지점(위/아래)에서 z 값을 다르게 주어
 * 매듭이 실제로 위아래로 교차하는 3D 곡선이 되도록 한다.
 *
 * 핵심 원칙: 크로싱과 크로싱 사이는 Tutte 임베딩이 보장하는 "겹치지 않는
 * 직선 구간"을 그대로 유지하고, 각 크로싱 근처에서만 짧게 둥글린다.
 *
 * (Python knot/curve.py 를 그대로 옮김 - 버그 수정 내역 포함:
 *  - n=2 성분에서 부호가 이중으로 뒤집혀 중간점이 겹치던 버그
 *  - 모든 점이 같은 (x,y)인 kink 에서 방향을 못 구하던 버그
 *  - angle_offset 을 z에 섞어 Hopf link 의 실제 linking 이 깨지던 버그
 *  - 2점짜리 성분(링크의 짧은 고리)이 다중 간선 슬롯 정보를 안 써서
 *    unlink 가 되어버리던 버그)
 */
import { portKey } from "./graph.js";

function linspace01(num) {
  const out = new Array(num);
  for (let i = 0; i < num; i++) out[i] = i / num;
  return out;
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function quadBezier3(a, c, b, t) {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * c[2] + t * t * b[2],
  ];
}

// 연속한 점 사이에 중심에서 바깥쪽으로 살짝 밀린 중간점을 끼워 넣는다.
// 크로싱이 아주 적은 성분(예: 링크의 각 고리)도 찌그러지지 않고 둥근
// 루프 모양이 되도록 하기 위함. angleOffset 은 여러 성분(링크)이 완전히
// 겹치지 않도록 성분마다 다르게 주는 회전 값이다 (XY 평면 안에서만 회전
// 시킨다 - z를 건드리면 링크의 실제 위상이 깨질 수 있다).
function withOutwardMidpoints(points, angleOffset = 0.0) {
  const n = points.length;
  if (n < 2) return points;

  const centroid = [0, 0];
  for (const p of points) {
    centroid[0] += p[0];
    centroid[1] += p[1];
  }
  centroid[0] /= n;
  centroid[1] /= n;

  const p1v = points[0];
  const p2v = points[Math.min(1, n - 1)];
  const segLen0 = Math.hypot(p1v[0] - p2v[0], p1v[1] - p2v[1]) || 1.0;
  const push = 0.5 * segLen0;

  const out = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    out.push(p1);

    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
    const direction = [mid[0] - centroid[0], mid[1] - centroid[1]];
    const norm = Math.hypot(direction[0], direction[1]);
    let unit;
    if (norm > 1e-9) {
      unit = [direction[0] / norm, direction[1] / norm];
    } else {
      const segDir = [p2[0] - p1[0], p2[1] - p1[1]];
      const segNorm = Math.hypot(segDir[0], segDir[1]);
      if (segNorm > 1e-9) {
        unit = [-segDir[1] / segNorm, segDir[0] / segNorm];
      } else {
        const angle = (2 * Math.PI * i) / n;
        unit = [Math.cos(angle), Math.sin(angle)];
      }
    }
    const cosO = Math.cos(angleOffset);
    const sinO = Math.sin(angleOffset);
    const rotatedUnit = [unit[0] * cosO - unit[1] * sinO, unit[0] * sinO + unit[1] * cosO];
    mid[0] += rotatedUnit[0] * push * 0.6;
    mid[1] += rotatedUnit[1] * push * 0.6;
    out.push(mid);
  }
  return out;
}

// 각 정점(크로싱)에서 두 인접 변을 cornerFrac 비율만큼만 안쪽으로
// 당겨 2차 베지어로 둥글리고, 나머지 구간은 원래 직선을 그대로 유지한다.
// bowOffsets[i] 가 주어지면(같은 두 크로싱을 잇는 평행한 변이 여러 개일
// 때), i번째 정점에서 나가는 직선 구간을 해당 [dx,dy] 만큼 옆으로 휘어
// 2차 베지어로 그린다.
function roundedCornerPolyline(points, bowOffsets, cornerFrac = 0.22, straightSamples = 5, cornerSamples = 8) {
  const n = points.length;
  if (n < 3) return points;

  const pBefore = new Array(n);
  const pAfter = new Array(n);
  for (let i = 0; i < n; i++) {
    const prevV = points[(i - 1 + n) % n];
    const nextV = points[(i + 1) % n];
    const pi = points[i];
    pBefore[i] = [
      pi[0] + (prevV[0] - pi[0]) * cornerFrac,
      pi[1] + (prevV[1] - pi[1]) * cornerFrac,
      pi[2] + (prevV[2] - pi[2]) * cornerFrac,
    ];
    pAfter[i] = [
      pi[0] + (nextV[0] - pi[0]) * cornerFrac,
      pi[1] + (nextV[1] - pi[1]) * cornerFrac,
      pi[2] + (nextV[2] - pi[2]) * cornerFrac,
    ];
  }

  const straightTs = linspace01(straightSamples);
  const cornerTs = linspace01(cornerSamples);
  const out = [];
  for (let i = 0; i < n; i++) {
    const prevI = (i - 1 + n) % n;
    const a = pAfter[prevI];
    const b = pBefore[i];
    const offset = bowOffsets ? bowOffsets[prevI] : null;
    if (offset) {
      const mid = [(a[0] + b[0]) / 2 + offset[0], (a[1] + b[1]) / 2 + offset[1], (a[2] + b[2]) / 2];
      for (const t of straightTs) out.push(quadBezier3(a, mid, b, t));
    } else {
      for (const t of straightTs) out.push(lerp3(a, b, t));
    }
    for (const t of cornerTs) out.push(quadBezier3(pBefore[i], points[i], pAfter[i], t));
  }
  return out;
}

// 두 크로싱 사이에 평행한 변이 여러 개(다중 간선)일 때, 각 변을
// 서로 다른 쪽으로 휘게 할 [dx,dy] 오프셋을 세그먼트별로 계산한다.
// 같은 변은 어느 방향에서 순회하든 항상 같은 물리적 위치로 휘도록
// u<v 기준 수직 방향(perp)을 고정해 부호를 맞춘다.
function computeBowOffsets(sequence, positions, edgeInfo) {
  if (!edgeInfo) return null;

  const n = sequence.length;
  const offsets = new Array(n).fill(null);
  let anyMulti = false;
  for (let i = 0; i < n; i++) {
    const exitPort = sequence[i].exitPort;
    const info = exitPort ? edgeInfo.get(portKey(exitPort)) : undefined;
    if (!info) continue;
    const { u, v, slot, k } = info;
    if (k <= 1) continue;
    anyMulti = true;
    const [ux, uy] = positions.get(u);
    const [vx, vy] = positions.get(v);
    const dx = vx - ux;
    const dy = vy - uy;
    const length = Math.hypot(dx, dy) || 1.0;
    const perp = [-dy / length, dx / length];
    // 2차 베지어는 t=0.5 에서 제어점 쪽으로 절반만 끌려가므로, 실제
    // 벌어지는 정도를 맞추기 위해 목표 간격보다 크게 잡는다.
    const offsetMag = (slot - (k - 1) / 2.0) * ((1.1 * length) / k);
    offsets[i] = [perp[0] * offsetMag, perp[1] * offsetMag];
  }

  return anyMulti ? offsets : null;
}

// 정확히 크로싱 2개만 방문하는 성분(예: Hopf link 처럼 두 크로싱을 잇는
// 아크가 여러 개인 링크의 각 고리)을 위한 전용 곡선. 두 구간(0->1, 1->0)이
// 모두 '평행한 변 중 하나'이므로, 각자 자신의 슬롯 번호에 따라 서로 다른
// 쪽으로 휘게 만들어야 실제로 서로를 통과하는 올바른 위상이 나온다.
function buildTwoPointCurve(rawPoints, bowOffsets, samples = 24) {
  const ts = linspace01(samples);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p1 = rawPoints[i];
    const p2 = rawPoints[(i + 1) % 2];
    const offset = bowOffsets[i];
    if (!offset) {
      for (const t of ts) out.push(lerp3(p1, p2, t));
      continue;
    }
    const mid = [(p1[0] + p2[0]) / 2 + offset[0], (p1[1] + p2[1]) / 2 + offset[1], (p1[2] + p2[2]) / 2];
    for (const t of ts) out.push(quadBezier3(p1, mid, p2, t));
  }
  return out;
}

// 하나의 성분(component)에 대해 [x,y,z] 폴리라인을 만든다.
// zEps 는 Map<crossingIndex, eps> (권장) 또는 모든 크로싱에 같은 값을
// 쓰는 숫자. edgeInfo 는 KnotGraph.multiEdgeInfo() 의 결과.
export function buildComponentCurve(
  sequence,
  positions,
  zEps,
  {
    edgeInfo = null,
    cornerFrac = 0.22,
    straightSamples = 5,
    cornerSamples = 8,
    angleOffset = 0.0,
  } = {}
) {
  const epsFor = (ci) => (zEps instanceof Map ? zEps.get(ci) : zEps);

  const raw = sequence.map((visit) => {
    const ci = visit.crossing;
    const [x, y] = positions.get(ci);
    const e = epsFor(ci);
    const z = visit.over ? e : -e;
    return [x, y, z];
  });

  const bowOffsets = computeBowOffsets(sequence, positions, edgeInfo);

  if (raw.length === 2 && bowOffsets !== null) {
    return buildTwoPointCurve(raw, bowOffsets);
  }

  if (raw.length < 3) {
    return withOutwardMidpoints(raw, angleOffset);
  }

  return roundedCornerPolyline(raw, bowOffsets, cornerFrac, straightSamples, cornerSamples);
}

// 각 크로싱마다, 그 크로싱에 인접한 변들의 평균 길이에 비례하는 z
// 오프셋을 계산한다 (전역 기준 대신 지역 기준을 써서, 뭉친 영역에서도
// 위/아래 간격이 적절히 보이게 한다). 반환값: Map<crossingIndex, eps>
export function computeLocalZEps(positions, adjacency, factor = 0.4) {
  const allLengths = [];
  const local = new Map();
  for (const [ci, neighbors] of adjacency.entries()) {
    if (neighbors.length === 0) {
      local.set(ci, null);
      continue;
    }
    const [x0, y0] = positions.get(ci);
    const dists = neighbors.map((nb) => {
      const [nx, ny] = positions.get(nb);
      return Math.hypot(x0 - nx, y0 - ny);
    });
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    local.set(ci, avg);
    allLengths.push(avg);
  }

  const fallback = allLengths.length ? allLengths.reduce((a, b) => a + b, 0) / allLengths.length : 1.0;
  const result = new Map();
  for (const [ci, val] of local.entries()) {
    result.set(ci, Math.max((val !== null ? val : fallback) * factor, 1e-4));
  }
  return result;
}

// 다이어그램에 있는 변들의 평균 길이. 기본 튜브 굵기 기준으로 쓴다.
export function computeAvgEdgeLength(positions, adjacency) {
  const lengths = [];
  for (const [ci, neighbors] of adjacency.entries()) {
    const [x0, y0] = positions.get(ci);
    for (const nb of neighbors) {
      const [nx, ny] = positions.get(nb);
      lengths.push(Math.hypot(x0 - nx, y0 - ny));
    }
  }
  return lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 1.0;
}

// 모든 크로싱 쌍 사이의 최소 거리.
export function computeMinSpacing(positions) {
  const pts = [...positions.values()];
  const n = pts.length;
  if (n < 2) return 1.0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

// 완성된 3D 곡선들(모든 성분)에서, 같은 성분 안의 바로 이웃한 구간을
// 제외한 모든 점 쌍 사이의 최소 거리. 링크처럼 성분끼리 실제로 맞물려야
// 하는 경우(예: Hopf link)는 서로 다른 성분 사이도 전부 비교 대상에 넣는다.
export function computeCurveClearance(components, skipWindow = 13) {
  const allPoints = [];
  components.forEach((comp, ci) => {
    comp.points.forEach((p, i) => allPoints.push([ci, i, p]));
  });

  const n = allPoints.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const [ci, li, pi] = allPoints[i];
    const ni = components[ci].points.length;
    for (let j = i + 1; j < n; j++) {
      const [cj, lj, pj] = allPoints[j];
      if (ci === cj) {
        const dIdx = Math.min(Math.abs(li - lj), ni - Math.abs(li - lj));
        if (dIdx < skipWindow) continue;
      }
      const d = Math.hypot(pi[0] - pj[0], pi[1] - pj[1], pi[2] - pj[2]);
      if (d < best) best = d;
    }
  }
  return best < Infinity ? best : 1.0;
}
