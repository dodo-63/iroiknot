/**
 * PD(Planar Diagram) 코드 문자열을 파싱하는 모듈.
 *
 * 지원 형식 예시 (trefoil, 3_1):
 *     "X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]"
 *     "PD[X[1,4,2,5], X[3,6,4,1], X[5,2,6,3]]"
 *
 * 각 크로싱은 X[a,b,c,d] 형태이며 a,b,c,d는 크로싱을 반시계 방향으로
 * 둘러싼 4개의 아크(호) 번호이다. (a,c)는 아래로 지나가는 가닥(under-strand),
 * (b,d)는 위로 지나가는 가닥(over-strand)의 포트 쌍이다.
 *
 * (Python knot/pd_parser.py 를 그대로 옮김)
 */

export class PDParseError extends Error {}

const CROSSING_RE = /X\s*\[\s*([^\]]+)\]/gi;

// { index, ports: [a,b,c,d] }
export function parsePdCode(text) {
  if (!text || !text.trim()) {
    throw new PDParseError("PD 코드가 비어 있습니다.");
  }

  const matches = [...text.matchAll(CROSSING_RE)].map((m) => m[1]);
  if (matches.length === 0) {
    throw new PDParseError(
      "X[a,b,c,d] 형태의 크로싱을 찾지 못했습니다. " +
        "예: X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]"
    );
  }

  const crossings = [];
  matches.forEach((group, i) => {
    const parts = group.split(",").map((p) => p.trim());
    if (parts.length !== 4) {
      throw new PDParseError(`${i + 1}번째 크로싱 X[${group}]에는 정확히 4개의 값이 필요합니다.`);
    }
    const ports = parts.map((p) => {
      if (!/^-?\d+$/.test(p)) {
        throw new PDParseError(`${i + 1}번째 크로싱 X[${group}]의 값이 정수가 아닙니다.`);
      }
      return parseInt(p, 10);
    });
    crossings.push({ index: i, ports });
  });

  validate(crossings);
  return crossings;
}

function validate(crossings) {
  const n = crossings.length;
  const labelCount = new Map();
  for (const c of crossings) {
    for (const p of c.ports) {
      labelCount.set(p, (labelCount.get(p) || 0) + 1);
    }
  }

  const bad = {};
  let hasBad = false;
  for (const [label, cnt] of labelCount.entries()) {
    if (cnt !== 2) {
      bad[label] = cnt;
      hasBad = true;
    }
  }
  if (hasBad) {
    throw new PDParseError(
      `각 아크 번호는 정확히 2번씩 등장해야 합니다. 어긋난 번호: ${JSON.stringify(bad)} (전체 크로싱 수: ${n})`
    );
  }
}
