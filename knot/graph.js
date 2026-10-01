/**
 * PD 코드로부터 4-정규(4-regular) 평면 그래프를 만들고,
 * 회전계(rotation system)를 이용해 면(face)을 추적하는 모듈.
 *
 * 각 크로싱은 포트 4개 (crossing_index, position) 를 가지며
 * position 0,1,2,3 은 PD 코드의 a,b,c,d 에 대응한다 (반시계 순서).
 *
 * Port 는 [crossingIndex, position] 쌍. Map/Set 키로 쓸 때는 portKey()로
 * "ci:pos" 문자열로 바꿔서 쓴다 (JS 배열은 참조 비교라 Map 키로 못 씀).
 *
 * (Python knot/graph.py 를 그대로 옮김)
 */

export class GraphError extends Error {}

export function portKey(port) {
  return `${port[0]}:${port[1]}`;
}

export class KnotGraph {
  constructor(crossings) {
    this.crossings = crossings;
    this.n = crossings.length;
    this.partner = this._buildPartner(); // Map<"ci:pos", [ci,pos]>
    this.faces = this._traceFaces(); // [[ci,pos], ...][]
  }

  // -- 아크 라벨을 이용해 포트끼리 연결(같은 라벨을 가진 두 포트가 서로의 짝) --
  _buildPartner() {
    const occurrences = new Map(); // label -> [ci,pos][]
    for (const c of this.crossings) {
      c.ports.forEach((label, pos) => {
        if (!occurrences.has(label)) occurrences.set(label, []);
        occurrences.get(label).push([c.index, pos]);
      });
    }

    const partner = new Map();
    for (const [label, ports] of occurrences.entries()) {
      if (ports.length !== 2) {
        throw new GraphError(`아크 ${label} 은 정확히 2번 등장해야 합니다.`);
      }
      const [p1, p2] = ports;
      partner.set(portKey(p1), p2);
      partner.set(portKey(p2), p1);
    }
    return partner;
  }

  // 같은 크로싱에서 반시계 방향으로 다음 포트.
  static rot(port) {
    return [port[0], (port[1] + 1) % 4];
  }

  // 크로싱을 '직진'해서 지나가는 반대편 포트 (같은 가닥).
  // 0<->2 는 언더스트랜드, 1<->3 은 오버스트랜드.
  static passThrough(port) {
    return [port[0], (port[1] + 2) % 4];
  }

  isOver(port) {
    return port[1] % 2 === 1;
  }

  // -- 회전계를 이용한 면 추적: face_next(p) = rot(partner[p]) --
  _traceFaces() {
    const allPorts = [];
    for (const c of this.crossings) {
      for (let pos = 0; pos < 4; pos++) allPorts.push([c.index, pos]);
    }
    const visited = new Set();
    const faces = [];
    for (const start of allPorts) {
      const startKey = portKey(start);
      if (visited.has(startKey)) continue;
      const face = [];
      let cur = start;
      for (;;) {
        visited.add(portKey(cur));
        face.push(cur);
        cur = KnotGraph.rot(this.partner.get(portKey(cur)));
        if (portKey(cur) === startKey) break;
      }
      faces.push(face);
    }
    return faces;
  }

  // 디버깅용: [V, E, F] 반환. 평면 그래프라면 V - E + F == 2.
  eulerCheck() {
    return [this.n, 2 * this.n, this.faces.length];
  }

  // 크로싱 간 인접 리스트 (자기 자신으로의 루프는 제외, Tutte 임베딩용).
  adjacency() {
    const adj = new Map();
    for (const c of this.crossings) adj.set(c.index, []);
    for (const c of this.crossings) {
      for (let pos = 0; pos < 4; pos++) {
        const [otherCi] = this.partner.get(portKey([c.index, pos]));
        if (otherCi !== c.index) adj.get(c.index).push(otherCi);
      }
    }
    return adj;
  }

  // 두 크로싱 사이에 아크(변)가 여러 개(다중 간선)일 때, 각 포트가
  // 속한 변을 {u, v, slot, k} 로 알려준다. u<v 는 정점 번호,
  // k 는 u-v 사이의 평행한 변의 총 개수, slot 은 그중 몇 번째인지(0..k-1).
  // 직선으로 그리면 완전히 겹쳐버리는 평행한 변들을 서로 다른 쪽으로
  // 휘어 그리기 위해 사용한다. 자기 자신으로의 루프(u==v)는 제외한다.
  // 반환값: Map<"ci:pos", {u,v,slot,k}>
  multiEdgeInfo() {
    const groups = new Map(); // "u:v" -> [[p,q], ...]
    const seen = new Set();
    for (const c of this.crossings) {
      for (let pos = 0; pos < 4; pos++) {
        const p = [c.index, pos];
        const pk = portKey(p);
        if (seen.has(pk)) continue;
        const q = this.partner.get(pk);
        seen.add(pk);
        seen.add(portKey(q));
        const u = p[0];
        const v = q[0];
        if (u === v) continue;
        const key = `${Math.min(u, v)}:${Math.max(u, v)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push([p, q]);
      }
    }

    const info = new Map();
    for (const [key, edges] of groups.entries()) {
      const [u, v] = key.split(":").map(Number);
      const k = edges.length;
      edges.forEach(([p, q], slot) => {
        info.set(portKey(p), { u, v, slot, k });
        info.set(portKey(q), { u, v, slot, k });
      });
    }
    return info;
  }
}
