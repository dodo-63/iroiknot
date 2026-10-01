/**
 * 작은 조밀 선형계 Ax = b 를 부분 피벗팅 가우스 소거법으로 푼다.
 * Tutte 임베딩에서 쓰는 행렬은 대각 성분이 1이고 나머지 행의 절댓값
 * 합이 1을 넘지 않는(대각 우세에 가까운) 라플라시안형이라 이 정도로도
 * 충분히 안정적으로 풀린다. numpy.linalg.solve 대응.
 */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row) => row.slice());
  const rhs = b.slice();

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [rhs[col], rhs[pivotRow]] = [rhs[pivotRow], rhs[col]];
    }
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      for (let cc = col; cc < n; cc++) M[r][cc] -= factor * M[col][cc];
      rhs[r] -= factor * rhs[col];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = rhs[row];
    for (let cc = row + 1; cc < n; cc++) sum -= M[row][cc] * x[cc];
    x[row] = Math.abs(M[row][row]) < 1e-12 ? 0 : sum / M[row][row];
  }
  return x;
}
