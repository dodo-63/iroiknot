/**
 * PD 코드 문자열 -> 3D 매듭 곡선 데이터. 전체 파이프라인의 진입점.
 * (Python knot/compute.py 를 그대로 옮김)
 */
import { parsePdCode } from "./pdParser.js";
import { KnotGraph } from "./graph.js";
import { tutteEmbedding } from "./embedding.js";
import { traverseComponents } from "./traversal.js";
import {
  buildComponentCurve,
  computeAvgEdgeLength,
  computeCurveClearance,
  computeLocalZEps,
  computeMinSpacing,
} from "./curve.js";

export class KnotComputeError extends Error {}

export function computeKnot(pdText) {
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
  const edgeInfo = graph.multiEdgeInfo();
  const zEpsMap = computeLocalZEps(positions, adjacency);
  const minSpacing = computeMinSpacing(positions);
  const avgEdgeLength = computeAvgEdgeLength(positions, adjacency);
  const componentsSeq = traverseComponents(graph);

  const components = componentsSeq.map((seq, idx) => {
    const angleOffset = idx * (3.14159265 / 3);
    const points = buildComponentCurve(seq, positions, zEpsMap, { edgeInfo, angleOffset });
    return { points, num_crossings_visited: seq.length };
  });

  // '보기 좋은 굵기'(변 평균 길이의 일부), '크로싱이 뭉개지지 않는 안전
  // 상한'(가장 촘촘한 두 크로싱 사이 거리 기준), 그리고 '실제로 완성된
  // 곡선에서 서로 다른 부분이 가장 가까워지는 거리' 중 가장 작은 값을 쓴다.
  const naturalRadius = 0.09 * avgEdgeLength;
  const safetyCap = 0.22 * minSpacing;
  const clearanceCap = 0.4 * computeCurveClearance(components);
  const suggestedTubeRadius = Math.max(Math.min(naturalRadius, safetyCap, clearanceCap), 1e-4);

  return {
    num_crossings: crossings.length,
    num_components: components.length,
    min_spacing: minSpacing,
    suggested_tube_radius: suggestedTubeRadius,
    components,
  };
}
