/**
 * PD 코드가 나타내는 매듭/링크의 가닥을 실제로 따라가며
 * 각 컴포넌트(성분)를 크로싱 방문 순서로 분해한다.
 *
 * 각 크로싱은 두 번 방문된다: 한 번은 아래로(under), 한 번은 위로(over).
 * '아크를 따라간다' -> '크로싱을 직진 통과한다' 를 번갈아 반복하면
 * 전체 다이어그램은 서로소인 사이클들(성분들)로 분해된다.
 *
 * (Python knot/traversal.py 를 그대로 옮김)
 */
import { KnotGraph, portKey } from "./graph.js";

// 반환값: [[{crossing, over, exitPort}, ...], ...] (성분별 방문 순서)
export function traverseComponents(graph) {
  const allPorts = [];
  for (const c of graph.crossings) {
    for (let pos = 0; pos < 4; pos++) allPorts.push([c.index, pos]);
  }
  const visited = new Set();
  const components = [];

  for (const start of allPorts) {
    if (visited.has(portKey(start))) continue;
    const sequence = [];
    let cur = start;
    while (!visited.has(portKey(cur))) {
      const exitPort = KnotGraph.passThrough(cur);
      visited.add(portKey(cur));
      visited.add(portKey(exitPort));
      sequence.push({
        crossing: cur[0],
        over: graph.isOver(cur),
        exitPort,
      });
      cur = graph.partner.get(portKey(exitPort));
    }
    components.push(sequence);
  }

  return components;
}
