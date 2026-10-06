// 2D 매듭 다이어그램의 순수 계산 로직 (DOM 없음).
//
// 모델: 매듭은 3D 폐곡선(제어점 [x, y, z] 의 순환 목록)이고, 화면에 보이는 2D
// 다이어그램은 그 곡선을 xy 평면에 투영한 것이다. z 는 화면에 직접 그려지지
// 않지만, 곡선이 스스로와 교차해 보이는 지점에서 어느 가닥이 위(over)이고
// 어느 가닥이 아래(under)인지를 정한다.
//
// 제어점을 xy 로 움직이다가 다른 가닥과 부딪히면, 막는 대신 움직이는 쪽의
// z 를 위(또는 Shift: 아래)로 올려서 3D 에서 스치지 않고 지나가게 한다.
// 이렇게 하면 어떤 편집을 해도 곡선이 3D 에서 스스로를 통과하지 않으므로
// (= 앰비언트 아이소토피) 매듭의 종류가 바뀌지 않고, 다이어그램에서는
// 라이데마이스터 이동(Reidemeister move)만 일어난다.

export const SEG_SAMPLES = 10; // 제어점 사이 한 구간(arc)을 몇 조각으로 나눠 샘플링할지

// ---------- 벡터 헬퍼 ([x, y, z] 배열) ----------
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------- Centripetal Catmull-Rom (Barry-Goldman) ----------
// 매개변수 간격은 xy 거리로만 잡는다. z(높이)까지 넣으면 점의 높이를 바꿀 때 화면에 보이는
// xy 모양까지 같이 달라져서, 잡은 arc 를 띄우는 동안 이웃 arc 들이 따라 움직여 보인다.
function knotStep(a, b) {
  return Math.max(Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1])), 1e-4);
}

// p1 -> p2 구간을 S 조각으로 샘플링한다. 반환: S+1 개의 점 (첫 점 = p1, 마지막 점 = p2)
function sampleSegment(p0, p1, p2, p3, S) {
  const t0 = 0;
  const t1 = t0 + knotStep(p0, p1);
  const t2 = t1 + knotStep(p1, p2);
  const t3 = t2 + knotStep(p2, p3);
  const out = [];
  for (let k = 0; k <= S; k++) {
    const u = t1 + ((t2 - t1) * k) / S;
    const a1 = lerp3(p0, p1, (u - t0) / (t1 - t0));
    const a2 = lerp3(p1, p2, (u - t1) / (t2 - t1));
    const a3 = lerp3(p2, p3, (u - t2) / (t3 - t2));
    const b1 = lerp3(a1, a2, (u - t0) / (t2 - t0));
    const b2 = lerp3(a2, a3, (u - t1) / (t3 - t1));
    out.push(lerp3(b1, b2, (u - t1) / (t2 - t1)));
  }
  return out;
}

// 제어점 목록(순환)으로부터 곡선 캐시를 만든다.
//   pieces[j] : j 번째 arc (제어점 j -> j+1) 의 샘플 S+1 개
//   start[j]  : 곡선 시작부터 arc j 시작까지의 3D 호 길이
//   len[j]    : arc j 의 3D 호 길이
//   bbox[j]   : arc j 의 [minx,miny,minz,maxx,maxy,maxz]
export function buildCurve(pts, S = SEG_SAMPLES) {
  const n = pts.length;
  const pieces = new Array(n);
  const start = new Array(n);
  const len = new Array(n);
  const bbox = new Array(n);
  let total = 0;
  for (let j = 0; j < n; j++) {
    const piece = sampleSegment(pts[(j - 1 + n) % n], pts[j], pts[(j + 1) % n], pts[(j + 2) % n], S);
    let l = 0;
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = 0; k < piece.length; k++) {
      if (k > 0) l += dist3(piece[k - 1], piece[k]);
      for (let d = 0; d < 3; d++) {
        if (piece[k][d] < bb[d]) bb[d] = piece[k][d];
        if (piece[k][d] > bb[d + 3]) bb[d + 3] = piece[k][d];
      }
    }
    pieces[j] = piece;
    start[j] = total;
    len[j] = l;
    bbox[j] = bb;
    total += l;
  }
  return { pieces, start, len, bbox, L: total, S };
}

// ---------- 두 3D 선분 사이의 최단 거리^2 (Ericson, Real-Time Collision Detection) ----------
function segDistSq(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1], d1z = p2[2] - p1[2];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1], d2z = p4[2] - p3[2];
  const rx = p1[0] - p3[0], ry = p1[1] - p3[1], rz = p1[2] - p3[2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const EPS = 1e-12;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  let s, t;
  if (a <= EPS && e <= EPS) {
    return rx * rx + ry * ry + rz * rz;
  }
  if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  const cx = p1[0] + d1x * s - (p3[0] + d2x * t);
  const cy = p1[1] + d1y * s - (p3[1] + d2y * t);
  const cz = p1[2] + d1z * s - (p3[2] + d2z * t);
  return cx * cx + cy * cy + cz * cz;
}

function bboxOverlap(a, b, margin) {
  return !(
    a[0] > b[3] + margin || b[0] > a[3] + margin ||
    a[1] > b[4] + margin || b[1] > a[4] + margin ||
    a[2] > b[5] + margin || b[2] > a[5] + margin
  );
}

// ---------- 충돌(= 3D 에서 스스로를 통과) 검사 ----------
// 성분 ci 의 제어점이 candPts 로 바뀐다고 가정했을 때, 모양이 바뀐 arc 들
// (affected: arc 인덱스 집합, candPts 기준) 이 곡선의 다른 부분과 minDist
// 안으로 가까워지면 true. curves[cc] 는 현재(변경 전) 곡선 캐시이고, 성분
// ci 의 캐시는 candPts 로 새로 만든다.
//
// 같은 성분에서 곡선을 따라 바로 이웃한 부분은 원래 붙어 있는 것이므로,
// 호 길이로 W 이내인 부분은 검사에서 뺀다.
export function violates(curves, ci, candPts, affected, minDist, S = SEG_SAMPLES, window = 2 * minDist) {
  const n = candPts.length;
  const cand = buildCurve(candPts, S);
  const aSet = new Set();
  for (const j of affected) aSet.add(((j % n) + n) % n);

  // affected 는 순환적으로 연속이라고 가정하고, 연속 구간의 시작을 찾는다.
  let first = 0;
  if (aSet.size < n) {
    for (const j of aSet) {
      if (!aSet.has((j - 1 + n) % n)) {
        first = j;
        break;
      }
    }
  }
  const order = [];
  for (let k = 0; k < aSet.size; k++) order.push((first + k) % n);

  // 바뀐 구간을 이루는 작은 선분들 (+ 구간 안에서의 호 길이)
  const chain = [];
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let local = 0;
  for (const j of order) {
    const piece = cand.pieces[j];
    for (let k = 0; k < S; k++) {
      const l = dist3(piece[k], piece[k + 1]);
      chain.push({ a: piece[k], b: piece[k + 1], ls: local, l });
      local += l;
    }
    for (let d = 0; d < 3; d++) {
      box[d] = Math.min(box[d], cand.bbox[j][d]);
      box[d + 3] = Math.max(box[d + 3], cand.bbox[j][d + 3]);
    }
  }
  const minSq = minDist * minDist;
  const W = window;
  const L = cand.L;

  // (1) 바뀐 구간 안에서 곡선상 멀리 떨어진 두 부분이 서로 가까워졌는가
  for (let u = 0; u < chain.length; u++) {
    for (let v = u + 1; v < chain.length; v++) {
      const fwd = chain[v].ls - (chain[u].ls + chain[u].l);
      const span = chain[v].ls + chain[v].l - chain[u].ls;
      if (Math.min(fwd, L - span) < W) continue;
      if (segDistSq(chain[u].a, chain[u].b, chain[v].a, chain[v].b) < minSq) return true;
    }
  }

  // (2) 바뀌지 않은 나머지 구간(같은 성분 + 다른 성분)과 가까워졌는가
  // 같은 성분이면, 곡선을 따라 바로 이웃한 두 작은 선분(호 길이 간격이 W 미만)은 원래
  // 붙어 있는 것이므로 짝으로 검사하지 않는다. 이 판단은 구간 전체가 아니라 선분
  // 하나하나의 호 길이 위치로 한다 (바뀐 구간의 반대쪽 끝이 구간 옆의 이웃 arc 에
  // 닿아 접히는 경우를 놓치지 않기 위해).
  const sA0 = cand.start[order[0]];
  const cyc = (d) => {
    d = Math.abs(d) % L;
    return Math.min(d, L - d);
  };
  for (let cc = 0; cc < curves.length; cc++) {
    const other = cc === ci ? cand : curves[cc];
    const m = other.pieces.length;
    for (let j = 0; j < m; j++) {
      if (cc === ci && aSet.has(j)) continue;
      if (!bboxOverlap(box, other.bbox[j], minDist)) continue;
      const piece = other.pieces[j];
      let so = other.start[j];
      for (let k = 0; k < S; k++) {
        const lo = dist3(piece[k], piece[k + 1]);
        const centerO = so + lo / 2;
        so += lo;
        for (let c = 0; c < chain.length; c++) {
          if (cc === ci) {
            const centerC = sA0 + chain[c].ls + chain[c].l / 2;
            if (cyc(centerC - centerO) - (chain[c].l + lo) / 2 < W) continue;
          }
          if (segDistSq(chain[c].a, chain[c].b, piece[k], piece[k + 1]) < minSq) return true;
        }
      }
    }
  }
  return false;
}

// 곡선 전체가 minDist 이상 떨어져 있는지 (초기 상태 검증용)
export function violatesAnywhere(comps, curves, minDist, S = SEG_SAMPLES, window = 2 * minDist) {
  for (let ci = 0; ci < comps.length; ci++) {
    const all = comps[ci].map((_, j) => j);
    if (violates(curves, ci, comps[ci], all, minDist, S, window)) return true;
  }
  return false;
}

function affectedForMoved(idxs, n) {
  const set = new Set();
  for (const k of idxs) for (let d = -2; d <= 1; d++) set.add(((k + d) % n + n) % n);
  return set;
}

// 가닥들이 위아래로 이만큼(* minDist) 여유 있게 떨어져 있도록 높이를 관리한다. 높이를 되돌릴 때
// 이 여유까지 납작하게 눌러 버리면, 나중에 그 사이로 다른 가닥을 끼워 넣을 자리가 없어져서
// 잡은 arc 를 위로 올리지 못하고 꼼짝 못 하게 된다.
const COMFORT = 3;

// ---------- 제어점 그룹 이동 ----------
// 충돌 판정에는 두 가지 거리를 쓴다.
//   minDist (soft) : 이 안으로 들어오면 '부딪혔다'고 보고 z 를 올려 피한다.
//   minDist/2 (hard): 어떤 경우에도 이 안으로는 들어가지 않는다. 한 걸음(최대 minDist/2)
//                     이 hard 거리의 두 배(= 가닥의 '두께')보다 작으므로, 한 걸음에 다른
//                     가닥을 뚫고 건너편으로 넘어가는 일(터널링)이 없다.
//
// comps[ci] 의 제어점 idxs (연속한 1개 또는 2개) 를 desiredXY (각각의 목표 [x,y])
// 쪽으로 옮긴다. 목표까지를 잘게 나눠 한 걸음씩 가면서, soft 거리 안으로 들어오는
// 걸음에서는 z 를 조금씩 (zdir: +1 위로 / -1 아래로, 안 되면 반대쪽) 움직여 지나간다.
// 이때 z 이동도 한 번에 minDist/4 씩 hard 거리를 지키면서 하므로, 이미 다른 가닥 '아래'에
// 있는 점을 위로 올려 그 가닥을 뚫고 지나가는 일은 hard 검사에 막혀 일어나지 않는다.
//
// opts.desiredZ 가 주어지면 z 도 목표로 함께 보간하고 z 올리기(피하기)는 하지 않는다
// (제어점 삭제 전에 이웃 쪽으로 접어 넣을 때 쓴다).
// comps / curves 를 직접 갱신한다. 반환: 목표까지 모두 도달했는지.
export function moveGroup(comps, curves, ci, idxs, desiredXY, zdir, minDist, S = SEG_SAMPLES, opts = {}) {
  const pts = comps[ci];
  const n = pts.length;
  const hard = minDist * 0.5;
  const zInc = minDist * 0.5; // hard 거리의 두 배(= 가닥 두께 minDist)보다 작아야 뚫고 지나가지 않는다
  const MAX_LIFT = 40;
  const W = 2 * minDist;

  // 잡은 점 바로 옆 이웃들도 z 를 따라 올라가야(거리에 따라 0.6, 0.25 배) 완만한 언덕이 되어 점을
  // 덜 높이 띄워도 다른 가닥을 넘을 수 있다. (이웃이 낮은 채로면 잡은 점만 아주 높이 올라가야 한다.)
  const ring = [];
  if (!opts.desiredZ && n > idxs.length + 4) {
    const first = idxs.length === 2 && (idxs[1] + 1) % n === idxs[0] ? idxs[1] : idxs[0];
    const last = idxs.length === 2 ? (first === idxs[0] ? idxs[1] : idxs[0]) : first;
    [0.6, 0.25].forEach((w, d) => {
      ring.push({ idx: (((first - d - 1) % n) + n) % n, w });
      ring.push({ idx: (last + d + 1) % n, w });
    });
  }
  const affected = affectedForMoved([...idxs, ...ring.map((r) => r.idx)], n);
  const vio = (cand, dist) => violates(curves, ci, cand, affected, dist, S, W);

  // moves: 잡은 점들의 새 위치. dz: 이번에 z 를 올린 양 (이웃 ring 이 비례해서 따라 올라간다)
  const candidateWith = (moves, dz = 0, useRing = true) => {
    const cand = pts.slice();
    idxs.forEach((idx, k) => {
      cand[idx] = moves[k];
    });
    if (dz !== 0 && useRing) for (const r of ring) cand[r.idx] = [pts[r.idx][0], pts[r.idx][1], pts[r.idx][2] + r.w * dz];
    return cand;
  };
  const commit = (moves, dz = 0, useRing = true) => {
    idxs.forEach((idx, k) => {
      pts[idx] = moves[k];
    });
    if (dz !== 0 && useRing) for (const r of ring) pts[r.idx] = [pts[r.idx][0], pts[r.idx][1], pts[r.idx][2] + r.w * dz];
    curves[ci] = buildCurve(pts, S);
  };

  // opts.floatTop: 잡은 점들이 움직이는 길 앞쪽(xy 로 가까운) 다른 가닥들보다 항상 위(zdir=-1 이면
  // 아래)에 있도록 미리 띄운다. 그러면 잡고 있는 쪽이 지나가는 가닥들의 over(under) arc 가 된다.
  // 전체에서 가장 높은 곳까지 올리지 않고 '지금 근처에서 필요한 만큼'만 올리므로 높이가 계단처럼
  // 쌓이지 않는다. 이미 다른 가닥 바로 아래(위)에 겹쳐 있으면 그 가닥에 막혀 거기까지만 올라간다.
  // 한 번에 minDist/2 씩만 올리며 hard 거리를 지키므로 가닥을 뚫지 않는다.
  const skipPieces = new Set(); // 잡은 점들 근처의 자기 arc 는 '다른 가닥'으로 세지 않는다
  for (const i of idxs) for (let d = -3; d <= 3; d++) skipPieces.add((((i + d) % n) + n) % n);
  const LOOKAHEAD = 4 * minDist;

  const neededTarget = (xy) => {
    let top = zdir > 0 ? -Infinity : Infinity;
    for (let cc = 0; cc < curves.length; cc++) {
      const cv = curves[cc];
      for (let j = 0; j < cv.pieces.length; j++) {
        if (cc === ci && skipPieces.has(j)) continue;
        const bb = cv.bbox[j];
        if (!xy.some(([x, y]) => x > bb[0] - LOOKAHEAD && x < bb[3] + LOOKAHEAD && y > bb[1] - LOOKAHEAD && y < bb[4] + LOOKAHEAD)) continue;
        for (const p of cv.pieces[j]) {
          if (xy.some(([x, y]) => Math.hypot(p[0] - x, p[1] - y) < LOOKAHEAD)) top = zdir > 0 ? Math.max(top, p[2]) : Math.min(top, p[2]);
        }
      }
    }
    return top === Infinity || top === -Infinity ? null : top + zdir * COMFORT * minDist;
  };

  // 잡은 점마다 자기 쪽 바깥 이웃들(ring)만 데리고 따로 올라간다. 한쪽 끝이 다른 가닥 밑에 끼어
  // 있어 못 올라가도, 다른 쪽 끝은 올라가서 새로 만나는 가닥 위를 지나갈 수 있어야 한다.
  const pointRings = idxs.map((idx, k) => {
    if (!ring.length) return [];
    if (idxs.length === 1) return ring;
    const first = (idxs[1] + 1) % n === idxs[0] ? idxs[1] : idxs[0];
    const beforeSide = idx === first;
    return ring.filter((r) => (((r.idx - idx) % n) + n) % n > n / 2 === beforeSide);
  });

  const floatToward = (targets) => {
    const startedClear = !vio(pts, minDist);
    for (let iter = 0; iter < 60; iter++) {
      let progressed = false;
      for (let k = 0; k < idxs.length; k++) {
        const target = targets[k];
        if (target === null) continue;
        const idx = idxs[k];
        const z = pts[idx][2];
        const need = zdir > 0 ? target - z : z - target;
        if (need <= 1e-9) continue;
        const dz = zdir * Math.min(minDist * 0.5, need);
        const attempt = (useRing) => {
          const cand = pts.slice();
          cand[idx] = [pts[idx][0], pts[idx][1], z + dz];
          if (useRing) for (const r of pointRings[k]) cand[r.idx] = [pts[r.idx][0], pts[r.idx][1], pts[r.idx][2] + r.w * dz];
          return cand;
        };
        const blocked = (cand) => vio(cand, hard) || (startedClear && vio(cand, minDist));
        let cand = attempt(true);
        if (blocked(cand)) {
          cand = attempt(false);
          if (blocked(cand)) continue;
        }
        for (let q = 0; q < n; q++) pts[q] = cand[q];
        curves[ci] = buildCurve(pts, S);
        progressed = true;
      }
      if (!progressed) break;
    }
  };

  // 목표까지 한 걸음(최대 minDist/2)씩 간다. 스플라인이 제어점보다 더 크게 움직여 hard 거리를
  // 어기게 되는 걸음은 반씩 줄여서 다시 시도하고, 그래도 안 되면 거기서 멈춘다.
  let reached = true;
  for (let guard = 0; guard < 4000; guard++) {
    let rem = 0;
    idxs.forEach((idx, k) => {
      const dz = opts.desiredZ ? opts.desiredZ[k] - pts[idx][2] : 0;
      rem = Math.max(rem, Math.hypot(desiredXY[k][0] - pts[idx][0], desiredXY[k][1] - pts[idx][1], dz));
    });
    if (rem < 1e-9) break;

    let frac = Math.min(1, (minDist * 0.5) / rem);
    if (opts.floatTop && !opts.desiredZ) {
      floatToward(
        idxs.map((idx, k) =>
          neededTarget([
            [
              pts[idx][0] + (desiredXY[k][0] - pts[idx][0]) * frac,
              pts[idx][1] + (desiredXY[k][1] - pts[idx][1]) * frac,
            ],
          ])
        )
      );
    }
    let advanced = false;
    for (let attempt = 0; attempt < 4 && !advanced; attempt++, frac *= 0.5) {
      const next = idxs.map((idx, k) => [
        pts[idx][0] + (desiredXY[k][0] - pts[idx][0]) * frac,
        pts[idx][1] + (desiredXY[k][1] - pts[idx][1]) * frac,
        opts.desiredZ ? pts[idx][2] + (opts.desiredZ[k] - pts[idx][2]) * frac : pts[idx][2],
      ]);
      const nextCand = candidateWith(next);
      if (!vio(nextCand, minDist)) {
        commit(next);
        advanced = true;
        break;
      }
      if (vio(nextCand, hard)) continue; // 너무 가깝다: 더 작은 걸음으로
      if (opts.desiredZ) continue;
      // 이웃(ring)을 함께 올리는 방식 -> 잡은 점만 올리는 방식 순서로 시도한다. 방식은 올리는 동안
      // 바꾸지 않는다 (k 단계까지 올리는 경로 전체가 hard 거리를 지키는지 확인해야 하므로).
      for (const useRing of ring.length ? [true, false] : [false]) {
        for (const dir of [zdir, -zdir]) {
          for (let k = 1; k <= MAX_LIFT; k++) {
            const dz = dir * k * zInc;
            const tryMoves = next.map((p) => [p[0], p[1], p[2] + dz]);
            const cand = candidateWith(tryMoves, dz, useRing);
            if (vio(cand, hard)) break;
            if (!vio(cand, minDist)) {
              commit(tryMoves, dz, useRing);
              advanced = true;
              break;
            }
          }
          if (advanced) break;
        }
        if (advanced) break;
      }
    }
    if (!advanced) {
      reached = false;
      break;
    }
  }

  if (!opts.desiredZ && opts.relax !== false) relaxHeights(comps, curves, ci, idxs, minDist, S);
  return reached;
}

// 움직인 점들의 z 를 바깥쪽 이웃의 평균 높이 쪽으로 조금씩 되돌린다
// (충돌이 없는 범위에서만). 이렇게 하지 않으면 한 번 올라간 점이 계속 높이
// 떠 있게 된다.
export function relaxHeights(comps, curves, ci, idxs, minDist, S = SEG_SAMPLES) {
  const pts = comps[ci];
  const n = pts.length;
  if (n < idxs.length + 2) return false;
  let changed = false;
  const sorted = idxs.slice().sort((a, b) => a - b);
  const before = pts[(sorted[0] - 1 + n) % n];
  const after = pts[(sorted[sorted.length - 1] + 1) % n];
  const target = (before[2] + after[2]) / 2;
  const zStep = minDist * 0.5;
  const affected = affectedForMoved(idxs, n);
  if (violates(curves, ci, pts, affected, COMFORT * minDist, S, 2 * minDist)) return false;

  for (let iter = 0; iter < 3; iter++) {
    const moves = idxs.map((idx) => {
      const dz = Math.max(-zStep, Math.min(zStep, target - pts[idx][2]));
      return [pts[idx][0], pts[idx][1], pts[idx][2] + dz];
    });
    if (moves.every((m, k) => Math.abs(m[2] - pts[idxs[k]][2]) < 1e-9)) return changed;
    const cand = pts.slice();
    idxs.forEach((idx, k) => {
      cand[idx] = moves[k];
    });
    if (violates(curves, ci, cand, affectedForMoved(idxs, n), COMFORT * minDist, S, 2 * minDist)) return changed;
    idxs.forEach((idx, k) => {
      pts[idx] = moves[k];
    });
    curves[ci] = buildCurve(pts, S);
    changed = true;
  }
  return changed;
}

// 드래그가 끝난 뒤, 띄워 놓았던 점들을 (막히지 않는 만큼) 이웃 높이까지 천천히 내린다.
export function settleHeights(comps, curves, ci, idxs, minDist, S = SEG_SAMPLES) {
  const n = comps[ci].length;
  const around = new Set();
  for (const i of idxs) for (let d = -3; d <= 3; d++) around.add((((i + d) % n) + n) % n);
  for (let round = 0; round < 80; round++) {
    let changed = false;
    for (const p of around) {
      if (relaxHeights(comps, curves, ci, [p], minDist, S)) changed = true;
    }
    if (!changed) break;
  }
}

// ---------- 제어점 추가 / 삭제 ----------
// 점 하나를 넣거나 빼면 스플라인 모양이 조금 바뀐다. 그 변화 동안 다른 가닥을
// 뚫고 지나가지 않았다고 보장하려면, 바뀐 구간의 새 곡선과 옛 곡선이 서로
// 아주 가까워야 한다 (둘 사이가 다른 가닥과의 최소 거리보다 훨씬 작아야 함).
// 점을 넣거나 뺐을 때 곡선이 이 값(* minDist) 넘게 바뀌면 거부한다. 다른 가닥은 곡선에서 최소
// minDist 이상 떨어져 있으므로, 이보다 작게 바뀌는 동안에는 가닥을 건너뛸 수 없다.
const MAX_SHAPE_CHANGE = 0.9;

function pointSegDistSq(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = lenSq > 1e-18 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = a[0] + dx * t - p[0], ey = a[1] + dy * t - p[1], ez = a[2] + dz * t - p[2];
  return ex * ex + ey * ey + ez * ez;
}

// from 의 affected arc 들의 점이 to 곡선 전체에서 얼마나 떨어져 있는지의 최댓값
function directedDeviation(from, fromAffected, to) {
  let worst = 0;
  for (const j of fromAffected) {
    for (const p of from.pieces[j]) {
      let best = Infinity;
      for (let jj = 0; jj < to.pieces.length; jj++) {
        const piece = to.pieces[jj];
        for (let k = 0; k < piece.length - 1; k++) {
          const d = pointSegDistSq(p, piece[k], piece[k + 1]);
          if (d < best) best = d;
        }
      }
      if (best > worst) worst = best;
    }
  }
  return Math.sqrt(worst);
}

function shapeDeviation(oldCurve, oldAffected, newCurve, newAffected) {
  return Math.max(
    directedDeviation(oldCurve, oldAffected, newCurve),
    directedDeviation(newCurve, newAffected, oldCurve)
  );
}

// arc j 위의 sub-segment k, 그 안에서의 비율 f 위치에 제어점을 추가한다.
// (곡선 위의 점이라 모양이 거의 안 바뀌지만, 충돌이 생기거나 모양이 minDist 에
// 비해 많이 바뀌면 거부한다.)
export function insertPoint(comps, curves, ci, j, k, f, minDist, S = SEG_SAMPLES) {
  const pts = comps[ci];
  const piece = curves[ci].pieces[j];
  const p = lerp3(piece[k], piece[k + 1], f);
  const cand = pts.slice();
  cand.splice(j + 1, 0, p);
  const m = j + 1;
  const affected = new Set();
  for (let d = -3; d <= 2; d++) affected.add(((m + d) % cand.length + cand.length) % cand.length);
  if (violates(curves, ci, cand, affected, minDist, S)) return false;
  const newCurve = buildCurve(cand, S);
  const oldAffected = [];
  for (let d = -3; d <= 1; d++) oldAffected.push(((j + d) % pts.length + pts.length) % pts.length);
  if (shapeDeviation(curves[ci], oldAffected, newCurve, affected) > MAX_SHAPE_CHANGE * minDist) return false;
  comps[ci] = cand;
  curves[ci] = newCurve;
  return true;
}

// 제어점 i 를 삭제한다. 먼저 그 점을, 지운 뒤의 곡선 위(두 이웃 사이의 한가운데)로
// 천천히 접어 넣어 (다른 가닥에 막히면 거부) 모양 변화를 작게 만든 뒤 지운다. 최소 4개는
// 남겨야 한다. 반환: "ok" | "too-few" | "collision"
export function deletePoint(comps, curves, ci, i, minDist, S = SEG_SAMPLES) {
  const n = comps[ci].length;
  if (n <= 4) return "too-few";
  const backup = comps[ci].slice();
  const backupCurve = curves[ci];
  const revert = () => {
    comps[ci].splice(0, comps[ci].length, ...backup);
    curves[ci] = backupCurve;
  };

  // 접어 넣을 목표: 점 i 를 뺀 곡선에서 두 이웃 사이 구간의 한가운데 (이 점을 지나는
  // 새 곡선이 뺀 뒤의 곡선과 가장 비슷해지도록).
  const without = backup.slice();
  without.splice(i, 1);
  const withoutCurve = buildCurve(without, S);
  const target = withoutCurve.pieces[(i - 1 + (n - 1)) % (n - 1)][S >> 1];
  const reached = moveGroup(comps, curves, ci, [i], [[target[0], target[1]]], 1, minDist, S, {
    desiredZ: [target[2]],
  });
  if (!reached) {
    revert();
    return "collision";
  }

  const pts = comps[ci];
  const cand = pts.slice();
  cand.splice(i, 1);
  const affected = new Set();
  for (let d = -3; d <= 1; d++) affected.add(((i + d) % cand.length + cand.length) % cand.length);
  const oldAffected = [];
  for (let d = -3; d <= 3; d++) oldAffected.push(((i + d) % n + n) % n);
  const newCurve = buildCurve(cand, S);
  if (
    violates(curves, ci, cand, affected, minDist, S) ||
    shapeDeviation(curves[ci], oldAffected, newCurve, affected) > MAX_SHAPE_CHANGE * minDist
  ) {
    revert();
    return "collision";
  }
  comps[ci] = cand;
  curves[ci] = newCurve;
  return "ok";
}

// ---------- 서버가 준 폴리라인 -> 제어점 ----------
// 닫힌 폴리라인을 호 길이 기준으로 균등하게 numControl 개의 점으로 다시 뽑는다.
// 호 길이는 xy(화면에 보이는 모양) 기준으로 잰다. z 까지 합쳐서 재면 크로싱 근처처럼
// 위아래로 급하게 오르내리는 곳에 점이 몰려서, 화면에서는 점이 겹쳐 보이게 된다.
export function controlsFromPolyline(points, numControl) {
  const m = points.length;
  const cum = [0];
  for (let i = 0; i < m; i++) {
    const a = points[i];
    const b = points[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  const total = cum[m];
  const out = [];
  let seg = 0;
  for (let c = 0; c < numControl; c++) {
    const target = (total * c) / numControl;
    while (seg < m - 1 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-12 ? (target - cum[seg]) / span : 0;
    out.push(lerp3(points[seg], points[(seg + 1) % m], t));
  }
  return out;
}

// ---------- 평면 변환 (z 는 건드리지 않는다) ----------
export function boundsCenter(comps) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of comps) {
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

// 화면 가운데의 세로축을 기준으로 매듭을 3D 에서 180° 돌린다 (위에서 내려다보면 반 바퀴
// 도는 회전). (x,y,z) -> (2cx-x, y, -z): 좌우가 뒤바뀌고 앞뒤도 뒤바뀌므로 위/아래
// 크로싱 정보가 서로 바뀌지만, 3D 에서의 강체 회전이라 같은 매듭이다.
export function rotate180(comps) {
  const [cx] = boundsCenter(comps);
  return comps.map((pts) => pts.map((p) => [2 * cx - p[0], p[1], -p[2]]));
}

// 좌우로 뒤집어 거울상을 만든다 ((x,y,z) -> (2cx-x, y, z)). 거울에 비친 모양이므로
// 매듭의 키랄성(chirality)이 바뀐다.
export function mirror(comps) {
  const [cx] = boundsCenter(comps);
  return comps.map((pts) => pts.map((p) => [2 * cx - p[0], p[1], p[2]]));
}

// ---------- 투영 교차점 찾기 ----------
// dense[c] = { x: [], y: [], z: [], s: [], L } (모두 화면 좌표, s = 누적 호 길이, 닫힌 곡선).
// 반환: 교차점 목록. over 는 위에 있는 쪽 ("a" | "b").
export function findCrossings(dense) {
  const segs = [];
  for (let c = 0; c < dense.length; c++) {
    const d = dense[c];
    const N = d.x.length;
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      segs.push({
        c, k, N,
        x1: d.x[k], y1: d.y[k], x2: d.x[k2], y2: d.y[k2],
        z1: d.z[k], z2: d.z[k2],
        s0: d.s[k],
        len: Math.hypot(d.x[k2] - d.x[k], d.y[k2] - d.y[k]),
      });
    }
  }
  if (segs.length === 0) return [];

  let avgLen = 0;
  for (const s of segs) avgLen += s.len;
  avgLen /= segs.length;
  const cell = Math.max(avgLen * 2, 1e-6);

  const grid = new Map();
  segs.forEach((s, idx) => {
    const x0 = Math.floor(Math.min(s.x1, s.x2) / cell);
    const x1 = Math.floor(Math.max(s.x1, s.x2) / cell);
    const y0 = Math.floor(Math.min(s.y1, s.y2) / cell);
    const y1 = Math.floor(Math.max(s.y1, s.y2) / cell);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = gx * 100003 + gy;
        let list = grid.get(key);
        if (!list) grid.set(key, (list = []));
        list.push(idx);
      }
    }
  });

  const seen = new Set();
  const out = [];
  for (const list of grid.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const ia = Math.min(list[i], list[j]);
        const ib = Math.max(list[i], list[j]);
        const pairKey = ia * segs.length + ib;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const A = segs[ia];
        const B = segs[ib];
        if (A.c === B.c) {
          const diff = Math.abs(A.k - B.k);
          if (Math.min(diff, A.N - diff) <= 2) continue;
        }
        const rx = A.x2 - A.x1, ry = A.y2 - A.y1;
        const sx = B.x2 - B.x1, sy = B.y2 - B.y1;
        const denom = rx * sy - ry * sx;
        if (Math.abs(denom) < 1e-12) continue;
        const qx = B.x1 - A.x1, qy = B.y1 - A.y1;
        const t = (qx * sy - qy * sx) / denom;
        const u = (qx * ry - qy * rx) / denom;
        if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
        const za = A.z1 + t * (A.z2 - A.z1);
        const zb = B.z1 + u * (B.z2 - B.z1);
        out.push({
          aComp: A.c, aS: A.s0 + t * A.len,
          bComp: B.c, bS: B.s0 + u * B.len,
          over: za >= zb ? "a" : "b",
          zOver: Math.max(za, zb),
          sinTheta: Math.abs(denom) / ((A.len * B.len) || 1),
          x: A.x1 + t * rx, y: A.y1 + t * ry,
        });
      }
    }
  }
  return out;
}
