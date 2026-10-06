import {
  SEG_SAMPLES,
  buildCurve,
  controlsFromPolyline,
  deletePoint,
  findCrossings,
  insertPoint,
  mirror,
  moveGroup,
  rotate180,
  settleHeights,
  violatesAnywhere,
} from "./knot2d-core.js";
import { computeDiagram2d } from "./knot/diagram2d.js";
import { KnotComputeError } from "./knot/compute.js";
import { PDParseError } from "./knot/pdParser.js";
import { EXAMPLES } from "./knot/examples.js";

const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const pdInput = document.getElementById("pd-input");
const exampleSelect = document.getElementById("example-select");
const renderBtn = document.getElementById("render-btn");
const errorBox = document.getElementById("error-box");
const statsBox = document.getElementById("stats");
const addPointBtn = document.getElementById("add-point-btn");
const deletePointBtn = document.getElementById("delete-point-btn");
const modeHint = document.getElementById("mode-hint");
const rotate180Btn = document.getElementById("rotate180-btn");
const mirrorBtn = document.getElementById("mirror-btn");
const renderStyleSelect = document.getElementById("render-style");
const lineColorContainer = document.getElementById("line-color-container");
const handleColorInput = document.getElementById("handle-color");
const lineWidthInput = document.getElementById("line-width");
const crossingGapInput = document.getElementById("crossing-gap");
const fitViewBtn = document.getElementById("fit-view-btn");
const langButtons = document.querySelectorAll(".lang-btn");

// ==== 다국어(i18n): 한국어 / 日本語 (3D 페이지와 같은 언어 설정을 공유) ====
const TRANSLATIONS = {
  ko: {
    pageTitle: "2D 매듭 다이어그램",
    link3D: "3D 보기 →",
    introHint: 'PD 코드를 입력하고 렌더링하세요. 예: <code>X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]</code>',
    exampleLabel: "예시 매듭",
    exampleDefaultOption: "-- 예시 선택 --",
    pdLabel: "PD 코드",
    renderBtn: "렌더링",
    controlPointsHeading: "제어점 · arc 조작",
    controlPointsHint:
      "노란 점을 드래그하면 그 점만, 점과 점 사이의 선(arc)을 드래그하면 양 끝 점이 함께 움직입니다. 다른 가닥과 부딪히면 위로 넘어가며(Shift를 누르고 있으면 아래로 지나갑니다), 매듭의 종류는 바뀌지 않습니다.",
    addPointBtn: "+ 점 추가",
    deletePointBtn: "− 점 삭제",
    transformHeading: "회전 · 거울상",
    rotate180Btn: "180° 회전",
    mirrorBtn: "거울상",
    transformHint:
      "180° 회전은 화면 가운데 세로축을 기준으로 매듭을 반 바퀴 돌립니다 (위에서 보면 180° 회전). 앞뒤가 뒤집혀 위/아래 크로싱이 서로 바뀌지만 같은 매듭입니다. 거울상은 좌우로만 뒤집어 거울에 비친 매듭을 만듭니다.",
    renderStyleHeading: "렌더링 스타일",
    renderStyleLabel: "스타일",
    styleFlatOption: "플랫 (단색)",
    styleToonOption: "카툰 (테두리)",
    lineColorLabel: "선 색깔",
    handleColorLabel: "제어점 색깔",
    lineWidthLabel: "선 굵기",
    crossingGapLabel: "크로싱 간격 (아래 가닥이 끊기는 폭)",
    fitViewBtn: "화면 맞춤",
    viewHint: "빈 곳을 드래그: 화면 이동 · 스크롤: 확대/축소",
    statsCrossings: "PD 크로싱 수",
    statsComponents: "성분 수",
    statsDiagram: "현재 다이어그램 크로싱",
    errMissingPD: "PD 코드를 입력하세요.",
    errUnknown: "알 수 없는 오류가 발생했습니다.",
    errNoServer: "계산 중 오류가 발생했습니다: {err}",
    errLoadExamples: "예시 목록을 불러오지 못했습니다: {err}",
    modeHintAdd: "선(arc) 위 원하는 위치를 클릭하면 그 자리에 제어점이 추가됩니다.",
    modeHintDelete: "삭제할 노란 점을 클릭하세요.",
    errTooFewPoints: "제어점이 너무 적어서 더 삭제할 수 없습니다 (최소 4개는 있어야 합니다).",
    errWouldCollide: "이 점을 삭제하면 매듭이 스스로를 통과하게 되어 삭제할 수 없습니다.",
    errAddCollide: "이 위치에는 점을 추가할 수 없습니다 (다른 가닥과 너무 가깝습니다).",
  },
  ja: {
    pageTitle: "2D結び目ダイアグラム",
    link3D: "3D表示 →",
    introHint: 'PDコードを入力してレンダリングしてください。例: <code>X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]</code>',
    exampleLabel: "サンプルの結び目",
    exampleDefaultOption: "-- サンプルを選択 --",
    pdLabel: "PDコード",
    renderBtn: "レンダリング",
    controlPointsHeading: "制御点・arcの操作",
    controlPointsHint:
      "黄色い点をドラッグするとその点だけ、点と点の間の線(arc)をドラッグすると両端の点が一緒に動きます。他の糸に触れると上を乗り越え(Shiftを押している間は下をくぐります)、結び目の種類は変わりません。",
    addPointBtn: "+ 点を追加",
    deletePointBtn: "− 点を削除",
    transformHeading: "回転・鏡像",
    rotate180Btn: "180°回転",
    mirrorBtn: "鏡像",
    transformHint:
      "180°回転は画面中央の縦軸を基準に結び目を半回転させます(上から見ると180°回転)。表裏が反転して上下の交差が入れ替わりますが同じ結び目です。鏡像は左右だけを反転して鏡に映した結び目にします。",
    renderStyleHeading: "レンダリングスタイル",
    renderStyleLabel: "スタイル",
    styleFlatOption: "フラット (単色)",
    styleToonOption: "トゥーン (輪郭線)",
    lineColorLabel: "線の色",
    handleColorLabel: "制御点の色",
    lineWidthLabel: "線の太さ",
    crossingGapLabel: "交差の隙間(下の糸が途切れる幅)",
    fitViewBtn: "画面に合わせる",
    viewHint: "何もない場所をドラッグ: 画面移動 · スクロール: 拡大縮小",
    statsCrossings: "PD交差数",
    statsComponents: "成分数",
    statsDiagram: "現在のダイアグラム交差数",
    errMissingPD: "PDコードを入力してください。",
    errUnknown: "不明なエラーが発生しました。",
    errNoServer: "計算中にエラーが発生しました: {err}",
    errLoadExamples: "サンプル一覧を読み込めませんでした: {err}",
    modeHintAdd: "線(arc)の上の好きな位置をクリックすると、そこに制御点が追加されます。",
    modeHintDelete: "削除したい黄色い点をクリックしてください。",
    errTooFewPoints: "制御点が少なすぎて、これ以上削除できません(最低4個は必要です)。",
    errWouldCollide: "この点を削除すると結び目が自分自身を通り抜けてしまうため、削除できません。",
    errAddCollide: "この位置には点を追加できません(他の糸に近すぎます)。",
  },
};

let currentLang = localStorage.getItem("knotViewerLang") || "ko";
let lastStats = null; // { crossings, components } 언어를 바꿔도 통계를 다시 그리기 위해 보관
let diagramCrossings = null;

function t(key, vars) {
  let str = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ?? TRANSLATIONS.ko[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
}

function showStats() {
  if (!lastStats) return;
  statsBox.innerHTML =
    `${t("statsCrossings")}: <b>${lastStats.crossings}</b>&nbsp;&nbsp;` +
    `${t("statsComponents")}: <b>${lastStats.components}</b>&nbsp;&nbsp;` +
    `${t("statsDiagram")}: <b>${diagramCrossings ?? "-"}</b>`;
  statsBox.classList.remove("hidden");
}

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("knotViewerLang", lang);
  document.documentElement.lang = lang;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  langButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.lang === lang));
  showStats();
  setInteractionMode(interactionMode);
  relabelLineColorRows();
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});

// ==== 색깔 ====
function hexInputToInt(input) {
  return parseInt(input.value.slice(1), 16);
}
function intToHex(color) {
  return "#" + color.toString(16).padStart(6, "0");
}
function cssColor(color) {
  return intToHex(color);
}

const DEFAULT_LINE_COLORS = [0x5aa9ff, 0xff6b6b, 0xffd166, 0x06d6a0, 0xc77dff, 0xf78c6b];
let lineColors = [DEFAULT_LINE_COLORS[0]];
let handleColor = hexInputToInt(handleColorInput);

function rebuildLineColorInputs(numComponents) {
  const n = Math.max(numComponents, 1);
  while (lineColors.length < n) {
    lineColors.push(DEFAULT_LINE_COLORS[lineColors.length % DEFAULT_LINE_COLORS.length]);
  }
  lineColors.length = n;

  lineColorContainer.innerHTML = "";
  for (let c = 0; c < n; c++) {
    const row = document.createElement("div");
    row.className = "slider-row";
    const label = document.createElement("label");
    label.setAttribute("for", `line-color-${c}`);
    const input = document.createElement("input");
    input.type = "color";
    input.id = `line-color-${c}`;
    input.value = intToHex(lineColors[c]);
    input.addEventListener("input", () => {
      lineColors[c] = hexInputToInt(input);
      requestRender();
    });
    row.appendChild(label);
    row.appendChild(input);
    lineColorContainer.appendChild(row);
  }
  relabelLineColorRows();
}

function relabelLineColorRows() {
  const rows = lineColorContainer.querySelectorAll(".slider-row");
  rows.forEach((row, idx) => {
    const label = row.querySelector("label");
    label.textContent = rows.length > 1 ? `${t("lineColorLabel")} ${idx + 1}` : t("lineColorLabel");
  });
}

// ==== 매듭 상태 ====
// comps[c]  : 성분 c 의 제어점 [x, y, z] 목록 (순환)
// curves[c] : comps[c] 로부터 만든 곡선 캐시 (knot2d-core.js 의 buildCurve)
let comps = [];
let curves = [];
let baseWidth = 0.2; // 서버가 준 '뭉개지지 않는 굵기'(월드 단위). 선 굵기 슬라이더의 최대값
let minDist = 0.05; // 가닥끼리 3D 에서 최소한 떨어져 있어야 하는 거리 (월드 단위)

// 화면 변환: world (x, y 위쪽이 +) <-> 화면 픽셀
const view = { cx: 0, cy: 0, scale: 100 };
let viewW = 1;
let viewH = 1;
// 사용자가 직접 화면을 옮기거나 확대하기 전까지는, 창 크기가 바뀔 때마다 매듭이
// 화면에 꽉 차게 다시 맞춘다 (처음 레이아웃이 잡히기 전에 계산된 크기를 바로잡기 위함이기도 하다).
let autoFit = true;

function toScreen(x, y) {
  return [(x - view.cx) * view.scale + viewW / 2, -(y - view.cy) * view.scale + viewH / 2];
}
function toWorld(sx, sy) {
  return [(sx - viewW / 2) / view.scale + view.cx, -(sy - viewH / 2) / view.scale + view.cy];
}

function lineWidthWorld() {
  return baseWidth * (parseFloat(lineWidthInput.value) || 0.3);
}
function lineWidthPx() {
  return Math.max(lineWidthWorld() * view.scale, 1.5);
}

function fitView() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cv of curves) {
    for (const piece of cv.pieces) {
      for (const p of piece) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
      }
    }
  }
  if (!isFinite(minX)) return;
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  view.cx = (minX + maxX) / 2;
  view.cy = (minY + maxY) / 2;
  view.scale = Math.min(viewW / (w * 1.25), viewH / (h * 1.25));
  requestRender();
}

function rebuildAllCurves() {
  curves = comps.map((pts) => buildCurve(pts));
}

function loadResult(result) {
  // 선 굵기 슬라이더의 최대값은 변의 평균 길이에 비례해 정한다.
  baseWidth = 0.12 * (result.avg_edge_length || 1);
  comps = result.components.map((comp) =>
    controlsFromPolyline(comp.points, Math.max(10, comp.num_crossings_visited * 3))
  );
  rebuildAllCurves();
  // 충돌 거리: 가닥끼리 3D 에서 최소한 이만큼은 떨어져 있어야 한다. 다시 뽑은
  // 제어점의 스플라인이 처음 곡선과 조금 달라질 수 있으므로, 처음 상태가 이미
  // 이 거리를 어기고 있지 않도록 안전할 때까지 줄여 간다.
  minDist = 0.5 * baseWidth;
  for (let i = 0; i < 8 && violatesAnywhere(comps, curves, minDist); i++) minDist *= 0.5;
  rebuildLineColorInputs(result.num_components);
  lastStats = { crossings: result.num_crossings, components: result.num_components };
  diagramCrossings = null;
  hover = null;
  autoFit = true;
  fitView();
  showStats();
}

// ==== 그리기 ====
let dirty = true;
function requestRender() {
  dirty = true;
}

function resizeCanvas() {
  const rect = viewport.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  viewW = Math.max(rect.width, 1);
  viewH = Math.max(rect.height, 1);
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;
  if (autoFit && curves.length > 0) fitView();
  requestRender();
}
new ResizeObserver(resizeCanvas).observe(viewport);

// 곡선 캐시(월드 좌표)를 화면 픽셀 좌표의 촘촘한 폴리라인으로 바꾼다.
function denseScreen(curve) {
  const S = curve.S;
  const n = curve.pieces.length;
  const N = n * S;
  const x = new Array(N);
  const y = new Array(N);
  const z = new Array(N);
  const s = new Array(N);
  let acc = 0;
  let idx = 0;
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < S; k++) {
      const p = curve.pieces[j][k];
      const [sx, sy] = toScreen(p[0], p[1]);
      if (idx > 0) acc += Math.hypot(sx - x[idx - 1], sy - y[idx - 1]);
      x[idx] = sx;
      y[idx] = sy;
      z[idx] = p[2];
      s[idx] = acc;
      idx++;
    }
  }
  const L = acc + Math.hypot(x[0] - x[N - 1], y[0] - y[N - 1]);
  return { x, y, z, s, L, N };
}

// 매듭(선)은 투명한 별도 레이어에 그린다. 크로싱의 틈은 배경색을 덧칠하는 게 아니라 이 레이어에서
// 지워서 만들기 때문에, 틈 뒤로 배경이나 (강조 후광 같은) 다른 그림이 그대로 비쳐 보인다.
let pen = ctx;

// 곡선의 호 길이 구간 [start, start+len] 을 현재 경로에 이어 붙인다.
function traceInterval(d, start, len) {
  const { N, L } = d;
  const a = ((start % L) + L) % L;
  const end = a + Math.min(len, L);
  const sUn = (i) => d.s[i % N] + L * Math.floor(i / N);
  const pointAt = (i, f) => {
    const k = i % N;
    const k2 = (i + 1) % N;
    return [d.x[k] + (d.x[k2] - d.x[k]) * f, d.y[k] + (d.y[k2] - d.y[k]) * f];
  };
  let lo = 0;
  let hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (d.s[mid] <= a) lo = mid;
    else hi = mid - 1;
  }
  let i = lo;
  const f0 = (a - sUn(i)) / (sUn(i + 1) - sUn(i) || 1);
  const p0 = pointAt(i, f0);
  pen.moveTo(p0[0], p0[1]);
  for (;;) {
    const nextS = sUn(i + 1);
    if (nextS >= end) {
      const f = (end - sUn(i)) / (nextS - sUn(i) || 1);
      const q = pointAt(i, f);
      pen.lineTo(q[0], q[1]);
      break;
    }
    i++;
    pen.lineTo(d.x[i % N], d.y[i % N]);
  }
}

function strokeComponent(d, color, width) {
  pen.strokeStyle = color;
  pen.lineWidth = width;
  pen.lineCap = "butt";
  pen.lineJoin = "round";
  pen.beginPath();
  pen.moveTo(d.x[0], d.y[0]);
  for (let i = 1; i < d.N; i++) pen.lineTo(d.x[i], d.y[i]);
  pen.closePath();
  pen.stroke();
}

// 크로싱에서 위 가닥의 그 부분만 다시 그린다. 먼저 배경색의 더 굵은 띠(후광)로 아래
// 가닥을 위 가닥의 선을 따라 잘라 낸 다음, 위 가닥을 그 위에 덧그린다. 그러면 아래
// 가닥의 끊어진 단면이 가로로 뚝 잘리지 않고 위 가닥의 가장자리와 나란한 곡선이 된다.
function paintOverStrand(d, centerS, half, haloWidth, outlineWidth, color, width) {
  const strokePiece = (lineWidth, style) => {
    pen.strokeStyle = style;
    pen.lineWidth = lineWidth;
    pen.lineCap = "butt";
    pen.lineJoin = "round";
    pen.beginPath();
    traceInterval(d, centerS - half, half * 2);
    pen.stroke();
  };
  pen.globalCompositeOperation = "destination-out";
  strokePiece(haloWidth, "#000");
  pen.globalCompositeOperation = "source-over";
  if (outlineWidth > 0) strokePiece(outlineWidth, OUTLINE_COLOR);
  strokePiece(width, color);
}

// 한 arc(제어점 j -> j+1)를 따라가는 경로 (강조 표시용)
function tracePiece(d, S, j) {
  const base = j * S;
  ctx.moveTo(d.x[base % d.N], d.y[base % d.N]);
  for (let k = 1; k <= S; k++) {
    const i = (base + k) % d.N;
    ctx.lineTo(d.x[i], d.y[i]);
  }
}

const BACKGROUND = "#10131a";
const OUTLINE_COLOR = "#08080c";
const HANDLE_HOVER_COLOR = "#ffffff";
const HANDLE_DELETE_HOVER_COLOR = "#ff5555";

// 다른 가닥(더 높은 z)이 위로 지나가며 가리고 있는 제어점인지: occluded[c][i]
// 마지막으로 그린 상태를 보관해 두고 히트 테스트에도 쓴다.
let knotLayer = null;
function getKnotLayer() {
  if (!knotLayer) knotLayer = document.createElement("canvas");
  if (knotLayer.width !== canvas.width || knotLayer.height !== canvas.height) {
    knotLayer.width = canvas.width;
    knotLayer.height = canvas.height;
  }
  return knotLayer;
}

let occluded = [];
function computeOccluded() {
  const half = lineWidthWorld() / 2;
  const zMargin = minDist * 0.25;
  return comps.map((pts, ci) =>
    pts.map((p, i) => {
      const n = pts.length;
      for (let cc = 0; cc < curves.length; cc++) {
        const cv = curves[cc];
        for (let j = 0; j < cv.pieces.length; j++) {
          // 자기 자신의 바로 옆 arc(이 점이 만드는 부분)는 건너뛴다
          if (cc === ci && [n - 2, n - 1, 0, 1].includes(((j - i) % n + n) % n)) continue;
          const piece = cv.pieces[j];
          for (let k = 0; k < cv.S; k++) {
            const a = piece[k];
            const b = piece[k + 1];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const lenSq = dx * dx + dy * dy;
            const f = lenSq > 1e-18 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq)) : 0;
            if (Math.hypot(a[0] + dx * f - p[0], a[1] + dy * f - p[1]) > half) continue;
            if (a[2] + (b[2] - a[2]) * f > p[2] + zMargin) return true;
          }
        }
      }
      return false;
    })
  );
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, viewW, viewH);
  if (comps.length === 0) return;

  const layer = getKnotLayer();
  const lctx = layer.getContext("2d");
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, layer.width, layer.height);
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const dense = curves.map(denseScreen);
  const crossings = findCrossings(dense);
  if (crossings.length !== diagramCrossings) {
    diagramCrossings = crossings.length;
    showStats();
  }

  const w = lineWidthPx();
  const toon = renderStyleSelect.value === "toon";
  const outline = toon ? Math.max(1.5, w * 0.12) : 0;
  const margin = w * (parseFloat(crossingGapInput.value) || 0); // 위 가닥 가장자리와 아래 가닥 사이의 틈

  // 마우스가 올라간 / 끌고 있는 arc 강조 (선 뒤쪽에 후광처럼)
  // 제어점을 끌 때(arcJ === null)는 어떤 arc 도 강조하지 않는다
  const active = drag ? (drag.arcJ === null ? null : { kind: "arc", ci: drag.ci, j: drag.arcJ }) : hover;
  if (active && active.kind === "arc" && curves[active.ci]) {
    ctx.save();
    ctx.strokeStyle = drag ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = w + outline * 2 + 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    tracePiece(dense[active.ci], curves[active.ci].S, active.j);
    ctx.stroke();
    ctx.restore();
  }

  // 1) 모든 가닥을 끝까지 그린 뒤, 2) 크로싱마다 위 가닥을 덧그려서 아래 가닥을 가린다.
  pen = lctx;
  const colorOf = (c) => cssColor(lineColors[c] ?? lineColors[0]);
  if (toon) dense.forEach((d) => strokeComponent(d, OUTLINE_COLOR, w + outline * 2));
  dense.forEach((d, c) => strokeComponent(d, colorOf(c), w));

  const stripHalf = w / 2 + outline + margin; // 위 가닥 중심선에서 후광 가장자리까지
  // 위 가닥이 낮은 크로싱부터 처리해야, 세 가닥이 한 곳에서 겹칠 때 더 위에 있는 가닥이
  // 아래 가닥의 틈에 지워지지 않고 맨 나중에 다시 그려진다.
  const ordered = crossings.slice().sort((p, q) => p.zOver - q.zOver);
  for (const cr of ordered) {
    const overIsA = cr.over === "a";
    const c = overIsA ? cr.aComp : cr.bComp;
    const sc = overIsA ? cr.aS : cr.bS;
    // 후광 띠가 아래 가닥을 완전히 가로지르는 구간을 덮을 만큼 길게 (교차각이 작을수록 길어진다)
    const half = (stripHalf + w / 2) / Math.max(cr.sinTheta, 0.25) + 2;
    paintOverStrand(dense[c], sc, half, stripHalf * 2, toon ? w + outline * 2 : 0, colorOf(c), w);
  }
  pen = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 제어점 (다른 가닥 아래에 가려진 점은 흐리게)
  occluded = computeOccluded();
  const r = Math.min(Math.max(w * 0.6, 4.5), 9);
  comps.forEach((pts, c) => {
    pts.forEach((p, i) => {
      const [sx, sy] = toScreen(p[0], p[1]);
      const isHover = hover && hover.kind === "handle" && hover.ci === c && hover.idx === i;
      const isDragged = drag && drag.ci === c && drag.idxs.includes(i);
      let fill = cssColor(handleColor);
      if (isDragged) fill = HANDLE_HOVER_COLOR;
      else if (isHover) fill = interactionMode === "delete" ? HANDLE_DELETE_HOVER_COLOR : HANDLE_HOVER_COLOR;
      ctx.save();
      if (occluded[c]?.[i] && !isDragged) ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, isHover || isDragged ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(8,8,12,0.85)";
      ctx.stroke();
      ctx.restore();
    });
  });
}

function frame() {
  if (dirty) {
    dirty = false;
    draw();
  }
  requestAnimationFrame(frame);
}

// ==== UI: PD 코드 -> 서버 -> 다이어그램 ====
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function hideError() {
  errorBox.classList.add("hidden");
}

// 서버 없이 브라우저에서 직접 계산한다 (knot/diagram2d.js).
function renderFromPD(pdText) {
  hideError();
  try {
    loadResult(computeDiagram2d(pdText));
  } catch (err) {
    if (err instanceof PDParseError || err instanceof KnotComputeError) {
      showError(err.message || t("errUnknown"));
    } else {
      showError(t("errNoServer", { err: err.message || err }));
    }
  }
}

renderBtn.addEventListener("click", () => {
  const text = pdInput.value.trim();
  if (!text) {
    showError(t("errMissingPD"));
    return;
  }
  renderFromPD(text);
});

exampleSelect.addEventListener("change", () => {
  const pd = exampleSelect.value;
  if (!pd) return;
  pdInput.value = pd;
  renderFromPD(pd);
});

function loadExamples() {
  try {
    for (const [name, pd] of Object.entries(EXAMPLES)) {
      const opt = document.createElement("option");
      opt.value = pd;
      opt.textContent = name;
      exampleSelect.appendChild(opt);
    }
    const firstEntry = Object.entries(EXAMPLES).find(([n]) => n.includes("trefoil"));
    if (firstEntry) {
      exampleSelect.value = firstEntry[1];
      pdInput.value = firstEntry[1];
      renderFromPD(firstEntry[1]);
    }
  } catch (err) {
    showError(t("errLoadExamples", { err: err.message || err }));
  }
}

lineWidthInput.addEventListener("input", requestRender);
crossingGapInput.addEventListener("input", requestRender);
renderStyleSelect.addEventListener("change", requestRender);
handleColorInput.addEventListener("input", () => {
  handleColor = hexInputToInt(handleColorInput);
  requestRender();
});
fitViewBtn.addEventListener("click", () => {
  autoFit = true;
  fitView();
});

// ==== 180° 회전 / 거울상 ====
rotate180Btn.addEventListener("click", () => {
  if (comps.length === 0) return;
  comps = rotate180(comps);
  rebuildAllCurves();
  hover = null;
  requestRender();
});
mirrorBtn.addEventListener("click", () => {
  if (comps.length === 0) return;
  comps = mirror(comps);
  rebuildAllCurves();
  hover = null;
  requestRender();
});

// ==== 상호작용 모드 ====
// "view"   : 기본 - 점/arc 드래그, 빈 곳 드래그는 화면 이동
// "add"    : arc 위를 클릭하면 그 자리에 제어점 추가
// "delete" : 제어점을 클릭하면 삭제
let interactionMode = "view";
let hover = null; // { kind: "handle", ci, idx } | { kind: "arc", ci, j }
let drag = null; // { ci, idxs, origin, grab, arcJ|null }
let pan = null; // { x, y }

function setInteractionMode(next) {
  interactionMode = next;
  addPointBtn.classList.toggle("active", next === "add");
  deletePointBtn.classList.toggle("active", next === "delete");
  modeHint.textContent = next === "add" ? t("modeHintAdd") : next === "delete" ? t("modeHintDelete") : "";
  hover = null;
  requestRender();
}
addPointBtn.addEventListener("click", () => setInteractionMode(interactionMode === "add" ? "view" : "add"));
deletePointBtn.addEventListener("click", () => setInteractionMode(interactionMode === "delete" ? "view" : "delete"));

// ---- 히트 테스트 ----
function hitHandle(sx, sy) {
  const w = lineWidthPx();
  const reach = Math.min(Math.max(w * 0.6, 4.5), 9) + 4;
  let best = null;
  comps.forEach((pts, ci) => {
    pts.forEach((p, idx) => {
      // 이동 모드에서는 위 가닥에 가려진 점은 잡히지 않는다 (대신 위 가닥이 잡힌다)
      if (interactionMode === "view" && occluded[ci]?.[idx]) return;
      const [px, py] = toScreen(p[0], p[1]);
      const d = Math.hypot(px - sx, py - sy);
      if (d <= reach && (!best || d < best.d)) best = { kind: "handle", ci, idx, d };
    });
  });
  return best;
}

// 커서 아래의 arc 를 찾는다. 가닥들이 겹쳐 보이는 곳에서는 위(over)에 있는 가닥을 고른다.
function hitArc(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const reachPx = Math.max(lineWidthPx() / 2 + 4, 8);
  const reach = reachPx / view.scale;
  let best = null;
  curves.forEach((cv, ci) => {
    cv.pieces.forEach((piece, j) => {
      for (let k = 0; k < cv.S; k++) {
        const a = piece[k];
        const b = piece[k + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const lenSq = dx * dx + dy * dy;
        const f = lenSq > 1e-18 ? Math.max(0, Math.min(1, ((wx - a[0]) * dx + (wy - a[1]) * dy) / lenSq)) : 0;
        const d = Math.hypot(a[0] + dx * f - wx, a[1] + dy * f - wy);
        if (d > reach) continue;
        const z = a[2] + (b[2] - a[2]) * f;
        if (!best || z > best.z + 1e-9 || (Math.abs(z - best.z) <= 1e-9 && d < best.d)) {
          best = { kind: "arc", ci, j, k, f, d, z };
        }
      }
    });
  });
  return best;
}

function localXY(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function setCursor(value) {
  canvas.style.cursor = value;
}

// ---- 포인터 이벤트 ----
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  const [sx, sy] = localXY(e);

  if (e.button === 1 || e.button === 2) {
    pan = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    setCursor("grabbing");
    return;
  }
  if (e.button !== 0) return;

  if (interactionMode === "add") {
    const hit = hitArc(sx, sy);
    if (hit) {
      if (insertPoint(comps, curves, hit.ci, hit.j, hit.k, hit.f, minDist)) {
        hideError();
      } else {
        showError(t("errAddCollide"));
      }
      hover = null;
      requestRender();
    }
    return;
  }

  if (interactionMode === "delete") {
    const hit = hitHandle(sx, sy);
    if (hit) {
      const result = deletePoint(comps, curves, hit.ci, hit.idx, minDist);
      if (result === "too-few") showError(t("errTooFewPoints"));
      else if (result === "collision") showError(t("errWouldCollide"));
      else hideError();
      hover = null;
      requestRender();
    }
    return;
  }

  const handle = hitHandle(sx, sy);
  const arc = handle ? null : hitArc(sx, sy);
  if (handle || arc) {
    const ci = (handle || arc).ci;
    const n = comps[ci].length;
    const idxs = handle ? [handle.idx] : [arc.j, (arc.j + 1) % n];
    drag = {
      ci,
      idxs,
      origin: idxs.map((i) => [comps[ci][i][0], comps[ci][i][1]]),
      grab: toWorld(sx, sy),
      arcJ: handle ? null : arc.j,
    };
    canvas.setPointerCapture(e.pointerId);
    setCursor("grabbing");
    requestRender();
    return;
  }

  pan = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  setCursor("grabbing");
});

canvas.addEventListener("pointermove", (e) => {
  const [sx, sy] = localXY(e);

  if (drag) {
    const [wx, wy] = toWorld(sx, sy);
    const dx = wx - drag.grab[0];
    const dy = wy - drag.grab[1];
    const desired = drag.origin.map(([ox, oy]) => [ox + dx, oy + dy]);
    moveGroup(comps, curves, drag.ci, drag.idxs, desired, e.shiftKey ? -1 : 1, minDist, undefined, {
      floatTop: true,
      relax: false,
    });
    requestRender();
    return;
  }

  if (pan) {
    autoFit = false;
    view.cx -= (e.clientX - pan.x) / view.scale;
    view.cy += (e.clientY - pan.y) / view.scale;
    pan.x = e.clientX;
    pan.y = e.clientY;
    requestRender();
    return;
  }

  let next = null;
  if (interactionMode === "add") {
    const arc = hitArc(sx, sy);
    next = arc ? { kind: "arc", ci: arc.ci, j: arc.j } : null;
    setCursor(arc ? "crosshair" : "default");
  } else if (interactionMode === "delete") {
    const h = hitHandle(sx, sy);
    next = h ? { kind: "handle", ci: h.ci, idx: h.idx } : null;
    setCursor(h ? "pointer" : "default");
  } else {
    const h = hitHandle(sx, sy);
    const arc = h ? null : hitArc(sx, sy);
    if (h) next = { kind: "handle", ci: h.ci, idx: h.idx };
    else if (arc) next = { kind: "arc", ci: arc.ci, j: arc.j };
    setCursor(next ? "grab" : "default");
  }
  const same =
    (!hover && !next) ||
    (hover && next && hover.kind === next.kind && hover.ci === next.ci && (hover.idx ?? hover.j) === (next.idx ?? next.j));
  if (!same) {
    hover = next;
    requestRender();
  }
});

function endInteraction(e) {
  if (drag) settleHeights(comps, curves, drag.ci, drag.idxs, minDist);
  drag = null;
  pan = null;
  if (e && e.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  setCursor("default");
  requestRender();
}
canvas.addEventListener("pointerup", endInteraction);
canvas.addEventListener("pointercancel", endInteraction);

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    autoFit = false;
    const [sx, sy] = localXY(e);
    const [wx, wy] = toWorld(sx, sy);
    view.scale = Math.min(Math.max(view.scale * Math.exp(-e.deltaY * 0.0015), 5), 20000);
    view.cx = wx - (sx - viewW / 2) / view.scale;
    view.cy = wy + (sy - viewH / 2) / view.scale;
    requestRender();
  },
  { passive: false }
);

// ---- 시작 ----
applyLanguage(currentLang);
resizeCanvas();
frame();
loadExamples();

// 디버깅/테스트용: 브라우저 콘솔에서 상태를 들여다볼 수 있게 한다.
window.__knot2d = {
  get comps() { return comps; },
  get curves() { return curves; },
  get minDist() { return minDist; },
  get view() { return view; },
  toScreen,
  toWorld,
  SEG_SAMPLES,
};
