/**
 * Tutte 임베딩: 회전계로부터 얻은 평면 그래프를 자기교차 없는
 * 2D 좌표로 배치한다 (바깥쪽 면을 정다각형에 고정하고, 나머지 정점은
 * 이웃의 평균 위치로 두는 선형 시스템을 풀어 구한다).
 *
 * (Python knot/embedding.py 를 그대로 옮김)
 */
import { solveLinear } from "./linalg.js";

export class EmbeddingError extends Error {}

function distinctFaceVertices(face) {
  const seq = [];
  const seen = new Set();
  for (const [ci] of face) {
    if (!seen.has(ci)) {
      seq.push(ci);
      seen.add(ci);
    }
  }
  return seq;
}

// 반환값: Map<crossingIndex, [x, y]>
export function tutteEmbedding(graph) {
  if (graph.n <= 2) {
    const positions = new Map();
    graph.crossings.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / graph.n;
      positions.set(c.index, [Math.cos(angle), Math.sin(angle)]);
    });
    return positions;
  }

  const facesBySize = [...graph.faces].sort((a, b) => b.length - a.length);

  let boundarySeq = [];
  for (const face of facesBySize) {
    const seq = distinctFaceVertices(face);
    if (seq.length >= 3) {
      boundarySeq = seq;
      break;
    }
  }
  if (boundarySeq.length < 3) {
    throw new EmbeddingError("3개 이상의 크로싱으로 이루어진 바깥 면을 찾지 못했습니다.");
  }

  const positions = new Map();
  const m = boundarySeq.length;
  boundarySeq.forEach((ci, i) => {
    const angle = (2 * Math.PI * i) / m;
    positions.set(ci, [Math.cos(angle), Math.sin(angle)]);
  });

  const interior = graph.crossings.map((c) => c.index).filter((ci) => !positions.has(ci));
  if (interior.length > 0) {
    const adj = graph.adjacency();
    const idxMap = new Map(interior.map((ci, i) => [ci, i]));
    const k = interior.length;
    const A = Array.from({ length: k }, () => new Array(k).fill(0));
    const bx = new Array(k).fill(0);
    const by = new Array(k).fill(0);

    for (const ci of interior) {
      const i = idxMap.get(ci);
      const neighbors = adj.get(ci);
      const deg = neighbors.length;
      A[i][i] = 1.0;
      if (deg === 0) continue;
      for (const nb of neighbors) {
        if (idxMap.has(nb)) {
          A[i][idxMap.get(nb)] -= 1.0 / deg;
        } else {
          const [nbX, nbY] = positions.get(nb);
          bx[i] += nbX / deg;
          by[i] += nbY / deg;
        }
      }
    }

    const xs = solveLinear(A, bx);
    const ys = solveLinear(A, by);
    for (const ci of interior) {
      positions.set(ci, [xs[idxMap.get(ci)], ys[idxMap.get(ci)]]);
    }
  }

  return positions;
}
