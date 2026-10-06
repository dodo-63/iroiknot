/**
 * PD 코드 -> 2D 매듭 다이어그램용 곡선 데이터. (Python knot/diagram2d.py 를 그대로 옮김)
 *
 * 3D 뷰어용 곡선(curve.js)은 3D 로 볼 때 보기 좋도록 만들어져 있어서, 그대로
 * xy 평면에 투영하면 크로싱에서 두 가닥이 거의 접하듯 스쳐 지나가 그림이
 * 뭉개져 보인다. 여기서는 같은 Tutte 임베딩(크로싱 위치)을 쓰되, 각 크로싱에서
 * 두 가닥이 서로 거의 수직으로 만나도록 접선 방향을 정하고, 크로싱 사이를
 * 에르미트(Hermite) 곡선으로 이어 평면 다이어그램에 어울리는 곡선을 만든다.
 *
 * z 는 크로싱에서 위(over) 가닥은 +eps, 아래(under) 가닥은 -eps 로 두고 그
 * 사이는 부드럽게 보간한다 (2D 화면에서 위/아래 구멍을 내는 데 쓰인다).
 *
 * 이 방식이 맞지 않는 퇴화한 경우(자기 자신으로 돌아오는 고리, 접선을 정할 수
 * 없는 크로싱)나, 만든 곡선의 투영 교차 수가 PD 코드의 크로싱 수와 다르게 나온
 * 경우에는 3D 뷰어와 같은 곡선으로 되돌아간다(fallback).
 */
import { parsePdCode } from "./pdParser.js";
import { KnotGraph, portKey } from "./graph.js";
import { tutteEmbedding } from "./embedding.js";
import { traverseComponents } from "./traversal.js";
import {
  buildComponentCurve,
  computeAvgEdgeLength,
  computeLocalZEps,
  computeMinSpacing,
} from "./curve.js";
import { KnotComputeError } from "./compute.js";

const SAMPLES_PER_EDGE = 24;
// 에르미트 접선 크기 = 이 값 * 두 크로싱 사이 거리. 클수록 크로싱에서 멀리까지 곧게
// 뻗지만 이웃한 변과 어긋나 투영 교차가 늘어날 수 있어, 위에서부터 차례로
// 시도해 PD 코드의 크로싱 수와 맞는 첫 값을 쓴다.
const TANGENT_SCALES = [0.8, 0.6, 0.45, 0.3];

class Degenerate extends Error {}

// 각 크로싱의 '기준 각도' phi 를 돌려준다. 포트 p 는 phi + 90°*p 방향으로 뻗어 나간다고
// 보는 것이다 (포트는 반시계 순서이므로 인접한 포트는 90° 차이, 따라서 같은 가닥(포트 p 와
// p+2)은 일직선이고 서로 다른 두 가닥은 정확히 수직으로 만난다).
// phi 는 Tutte 임베딩에서 실제로 이웃 크로싱이 있는 방향들에 가장 잘 맞도록 (각 포트의
// 실제 방향 - 90°*p 들의 원형 평균으로) 정한다.
function crossingFrames(graph, positions) {
  const frames = new Map();
  for (const c of graph.crossings) {
    const ci = c.index;
    const [px, py] = positions.get(ci);
    let sx = 0;
    let sy = 0;
    for (let pos = 0; pos < 4; pos++) {
      const [oc] = graph.partner.get(portKey([ci, pos]));
      if (oc === ci) throw new Degenerate("self loop");
      const dx = positions.get(oc)[0] - px;
      const dy = positions.get(oc)[1] - py;
      if (Math.hypot(dx, dy) < 1e-9) throw new Degenerate("coincident vertices");
      const theta = Math.atan2(dy, dx) - (pos * Math.PI) / 2;
      sx += Math.cos(theta);
      sy += Math.sin(theta);
    }
    if (Math.hypot(sx, sy) < 1e-6) throw new Degenerate("no preferred orientation");
    frames.set(ci, Math.atan2(sy, sx));
  }
  return frames;
}

function hermiteCurve(sequence, positions, zEps, frames, scale) {
  const visits = sequence.map((visit) => {
    const ci = visit.crossing;
    const exitPos = visit.exitPort[1];
    const angle = frames.get(ci) + (exitPos * Math.PI) / 2; // 나가는 포트 방향 = 진행 방향
    const z = visit.over ? zEps.get(ci) : -zEps.get(ci);
    return { p: positions.get(ci), t: [Math.cos(angle), Math.sin(angle)], z };
  });

  const n = visits.length;
  const points = [];
  for (let i = 0; i < n; i++) {
    const a = visits[i];
    const b = visits[(i + 1) % n];
    const chord = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const m0 = [a.t[0] * chord * scale, a.t[1] * chord * scale];
    const m1 = [b.t[0] * chord * scale, b.t[1] * chord * scale];
    for (let k = 0; k < SAMPLES_PER_EDGE; k++) {
      const t = k / SAMPLES_PER_EDGE;
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
      const h10 = t ** 3 - 2 * t ** 2 + t;
      const h01 = -2 * t ** 3 + 3 * t ** 2;
      const h11 = t ** 3 - t ** 2;
      const smooth = t * t * (3 - 2 * t);
      points.push([
        h00 * a.p[0] + h10 * m0[0] + h01 * b.p[0] + h11 * m1[0],
        h00 * a.p[1] + h10 * m0[1] + h01 * b.p[1] + h11 * m1[1],
        a.z + (b.z - a.z) * smooth,
      ]);
    }
  }
  return points;
}

// 크로싱이 1개뿐인 다이어그램(한 번 꼬인 고리)을 위한 8자 모양 곡선.
function kinkCurve(zAmp = 0.3, a = 1.2, samples = 96) {
  const pts = [];
  for (let k = 0; k < samples; k++) {
    const t = (2 * Math.PI * k) / samples;
    const denom = 1 + Math.sin(t) ** 2;
    pts.push([(a * Math.cos(t)) / denom, (a * Math.sin(t) * Math.cos(t)) / denom, zAmp * Math.sin(t)]);
  }
  return pts;
}

// Hopf 링크(크로싱 2개, 성분 2개)를 위한 서로 겹친 두 원. 위/아래가 번갈아 오도록 z 를 준다.
function hopfCurves(zAmp = 0.35, samples = 96) {
  return [
    [-0.5, 1.0],
    [0.5, -1.0],
  ].map(([cx, sign]) => {
    const pts = [];
    for (let k = 0; k < samples; k++) {
      const t = (2 * Math.PI * k) / samples;
      pts.push([cx + Math.cos(t), Math.sin(t), sign * zAmp * Math.sin(t)]);
    }
    return pts;
  });
}

// 닫힌 폴리라인들의 xy 투영에서 서로 교차하는 점의 개수 (이웃한 선분끼리는 제외).
export function countProjectionCrossings(components) {
  const segs = [];
  components.forEach((pts, c) => {
    const m = pts.length;
    for (let k = 0; k < m; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % m];
      segs.push({ c, k, m, px: p[0], py: p[1], rx: q[0] - p[0], ry: q[1] - p[1] });
    }
  });
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    const A = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
      const B = segs[j];
      const denom = A.rx * B.ry - A.ry * B.rx;
      if (Math.abs(denom) <= 1e-14) continue;
      const qx = B.px - A.px;
      const qy = B.py - A.py;
      const t = (qx * B.ry - qy * B.rx) / denom;
      const u = (qx * A.ry - qy * A.rx) / denom;
      // 두 가닥이 크로싱 꼭짓점(샘플 점)에서 정확히 만나므로, 경계에서 부동소수점 오차로 세는 횟수가
      // 달라지지 않도록 [0,1) 구간을 오차 범위만큼 안쪽으로 맞춰서 정확히 한 번만 세게 한다.
      const eps = 1e-9;
      if (!(t >= -eps && t < 1 - eps && u >= -eps && u < 1 - eps)) continue;
      if (A.c === B.c) {
        const diff = Math.abs(A.k - B.k);
        if (Math.min(diff, A.m - diff) <= 2) continue;
      }
      count++;
    }
  }
  return count;
}

export function computeDiagram2d(pdText) {
  const crossings = parsePdCode(pdText);
  const graph = new KnotGraph(crossings);

  const [v, e, f] = graph.eulerCheck();
  if (v - e + f !== 2) {
    throw new KnotComputeError(
      "이 PD 코드는 평면(구면) 위에 그릴 수 있는 다이어그램이 아닌 것 같습니다. " +
        `(V=${v}, E=${e}, F=${f}, 오일러 지표=${v - e + f}, 2 이어야 함)`
    );
  }

  const positions = tutteEmbedding(graph);
  const adjacency = graph.adjacency();
  const zEps = computeLocalZEps(positions, adjacency);
  const avgEdgeLength = computeAvgEdgeLength(positions, adjacency);
  const componentsSeq = traverseComponents(graph);

  let pointLists = null;
  let layout = "fallback";
  if (graph.n === 1) {
    pointLists = [kinkCurve()];
    layout = "kink";
  } else if (graph.n === 2 && componentsSeq.length === 2 && componentsSeq.every((q) => q.length === 2)) {
    pointLists = hopfCurves();
    layout = "hopf";
  } else if (graph.n >= 3) {
    try {
      const frames = crossingFrames(graph, positions);
      for (const scale of TANGENT_SCALES) {
        const candidate = componentsSeq.map((seq) => hermiteCurve(seq, positions, zEps, frames, scale));
        if (countProjectionCrossings(candidate) === graph.n) {
          pointLists = candidate;
          layout = "hermite";
          break;
        }
      }
    } catch (err) {
      if (!(err instanceof Degenerate)) throw err;
    }
  }

  if (pointLists === null) {
    const edgeInfo = graph.multiEdgeInfo();
    pointLists = componentsSeq.map((seq, idx) =>
      buildComponentCurve(seq, positions, zEps, { edgeInfo, angleOffset: idx * (3.14159265 / 3) })
    );
  }

  return {
    num_crossings: crossings.length,
    num_components: pointLists.length,
    avg_edge_length: avgEdgeLength,
    min_spacing: computeMinSpacing(positions),
    layout,
    components: pointLists.map((pts, i) => ({ points: pts, num_crossings_visited: componentsSeq[i].length })),
  };
}
