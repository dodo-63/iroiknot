import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { computeKnot, KnotComputeError } from "./knot/compute.js";
import { PDParseError } from "./knot/pdParser.js";
import { EXAMPLES } from "./knot/examples.js";

const viewport = document.getElementById("viewport");
const pdInput = document.getElementById("pd-input");
const exampleSelect = document.getElementById("example-select");
const renderBtn = document.getElementById("render-btn");
const errorBox = document.getElementById("error-box");
const statsBox = document.getElementById("stats");

const rotX = document.getElementById("rot-x");
const rotY = document.getElementById("rot-y");
const rotZ = document.getElementById("rot-z");
const resetRotBtn = document.getElementById("reset-rot-btn");
const autoRotateCb = document.getElementById("auto-rotate");
const autoAxisSelect = document.getElementById("auto-axis");
const tubeRadiusInput = document.getElementById("tube-radius");
const addPointBtn = document.getElementById("add-point-btn");
const deletePointBtn = document.getElementById("delete-point-btn");
const modeHint = document.getElementById("mode-hint");
const renderStyleSelect = document.getElementById("render-style");
const lineColorContainer = document.getElementById("line-color-container");
const handleColorInput = document.getElementById("handle-color");
const langButtons = document.querySelectorAll(".lang-btn");

// ==== 다국어(i18n): 한국어 / 日本語 ====
const TRANSLATIONS = {
  ko: {
    pageTitle: "3D 매듭 뷰어",
    link2D: "2D 보기 →",
    introHint: 'PD 코드를 입력하고 렌더링하세요. 예: <code>X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]</code>',
    exampleLabel: "예시 매듭",
    exampleDefaultOption: "-- 예시 선택 --",
    pdLabel: "PD 코드",
    renderBtn: "렌더링",
    controlPointsHeading: "제어점 조작",
    controlPointsHint:
      "노란 점을 드래그하면 매듭 모양을 직접 바꿀 수 있습니다 · 매듭은 스스로를 통과하지 못하므로 다른 가닥에 닿으면 더 이상 밀리지 않습니다 (크로싱이 절대 바뀌지 않습니다).",
    addPointBtn: "+ 점 추가",
    deletePointBtn: "− 점 삭제",
    renderStyleHeading: "렌더링 스타일",
    renderStyleLabel: "스타일",
    styleLitOption: "기본 (라이팅)",
    styleToonOption: "카툰 (테두리)",
    styleFlatOption: "플랫 (무광)",
    lineColorLabel: "선 색깔",
    handleColorLabel: "제어점 색깔",
    rotationHeading: "회전 조작",
    rotationHint: "빈 곳을 마우스로 드래그: 매듭 회전 (아래 X/Y/Z 슬라이더와 동기화) · 스크롤: 확대/축소",
    rotXLabel: "X축 회전",
    rotYLabel: "Y축 회전",
    rotZLabel: "Z축 회전",
    resetRotBtn: "회전 초기화",
    autoRotateLabel: "자동 회전",
    axisXOption: "X축",
    axisYOption: "Y축",
    axisZOption: "Z축",
    tubeRadiusLabel: "튜브 굵기",
    statsCrossings: "크로싱 수",
    statsComponents: "성분 수",
    errMissingPD: "PD 코드를 입력하세요.",
    errUnknown: "알 수 없는 오류가 발생했습니다.",
    errNoServer: "계산 중 오류가 발생했습니다: {err}",
    errLoadExamples: "예시 목록을 불러오지 못했습니다: {err}",
    modeHintAdd: "매듭 위 원하는 위치를 클릭하면 그 자리에 제어점이 추가됩니다.",
    modeHintDelete: "삭제할 노란 점을 클릭하세요.",
    errTooFewPoints: "제어점이 너무 적어서 더 삭제할 수 없습니다 (최소 4개는 있어야 합니다).",
    errWouldCollide: "이 점을 삭제하면 매듭이 스스로를 통과하게 되어 삭제할 수 없습니다.",
  },
  ja: {
    pageTitle: "3D結び目ビューア",
    link2D: "2D表示 →",
    introHint: 'PDコードを入力してレンダリングしてください。例: <code>X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]</code>',
    exampleLabel: "サンプルの結び目",
    exampleDefaultOption: "-- サンプルを選択 --",
    pdLabel: "PDコード",
    renderBtn: "レンダリング",
    controlPointsHeading: "制御点の操作",
    controlPointsHint:
      "黄色い点をドラッグすると結び目の形を直接変えられます · 結び目は自分自身を通り抜けられないので、他の糸に触れるとそれ以上押し込めません(交差が変わることは絶対にありません)。",
    addPointBtn: "+ 点を追加",
    deletePointBtn: "− 点を削除",
    renderStyleHeading: "レンダリングスタイル",
    renderStyleLabel: "スタイル",
    styleLitOption: "標準 (ライティング)",
    styleToonOption: "トゥーン (輪郭線)",
    styleFlatOption: "フラット (つや消し)",
    lineColorLabel: "線の色",
    handleColorLabel: "制御点の色",
    rotationHeading: "回転操作",
    rotationHint: "何もない場所をドラッグ: 結び目を回転(下のX/Y/Zスライダーと連動) · スクロール: 拡大縮小",
    rotXLabel: "X軸回転",
    rotYLabel: "Y軸回転",
    rotZLabel: "Z軸回転",
    resetRotBtn: "回転をリセット",
    autoRotateLabel: "自動回転",
    axisXOption: "X軸",
    axisYOption: "Y軸",
    axisZOption: "Z軸",
    tubeRadiusLabel: "チューブの太さ",
    statsCrossings: "交差数",
    statsComponents: "成分数",
    errMissingPD: "PDコードを入力してください。",
    errUnknown: "不明なエラーが発生しました。",
    errNoServer: "計算中にエラーが発生しました: {err}",
    errLoadExamples: "サンプル一覧を読み込めませんでした: {err}",
    modeHintAdd: "結び目の上の好きな位置をクリックすると、そこに制御点が追加されます。",
    modeHintDelete: "削除したい黄色い点をクリックしてください。",
    errTooFewPoints: "制御点が少なすぎて、これ以上削除できません(最低4個は必要です)。",
    errWouldCollide: "この点を削除すると結び目が自分自身を通り抜けてしまうため、削除できません。",
  },
};

let currentLang = localStorage.getItem("knotViewerLang") || "ko";
let lastStatsResult = null; // 언어를 바꿨을 때 통계 표시를 다시 그리기 위해 보관

function t(key, vars) {
  let str = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ?? TRANSLATIONS.ko[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
}

function showStats(result) {
  lastStatsResult = result;
  statsBox.innerHTML = `${t("statsCrossings")}: <b>${result.num_crossings}</b>&nbsp;&nbsp;${t("statsComponents")}: <b>${result.num_components}</b>`;
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

  // 현재 화면에 떠 있는 동적 텍스트(통계, 제어점 모드 안내, 선 색깔 라벨)도
  // 새 언어로 갱신한다.
  if (lastStatsResult) showStats(lastStatsResult);
  setInteractionMode(interactionMode);
  relabelLineColorRows();
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});

const HANDLE_HOVER_COLOR = 0xffffff;
const HANDLE_DELETE_HOVER_COLOR = 0xff5555;

// 선(튜브)과 제어점 색깔은 사용자가 색상 선택기로 직접 고른다. 성분
// (컴포넌트)이 여러 개인 링크는 성분마다 다른 선 색깔을 고를 수 있다.
function hexInputToInt(input) {
  return parseInt(input.value.slice(1), 16);
}
function intToHex(color) {
  return "#" + color.toString(16).padStart(6, "0");
}

const DEFAULT_LINE_COLORS = [0x5aa9ff, 0xff6b6b, 0xffd166, 0x06d6a0, 0xc77dff, 0xf78c6b];
let lineColors = [DEFAULT_LINE_COLORS[0]];
let currentHandleColor = hexInputToInt(handleColorInput);

// 성분 개수에 맞춰 선 색깔 선택기를 다시 그린다. 기존에 고른 색은 배열을
// 자르거나 늘리기만 해서 최대한 유지하고, 새로 생기는 성분에는 기본
// 팔레트 색을 순서대로 준다.
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
      rebuildTubes();
    });
    row.appendChild(label);
    row.appendChild(input);
    lineColorContainer.appendChild(row);
  }
  relabelLineColorRows();
}

// 선 색깔 선택기들의 라벨 텍스트만 새로 고친다 (언어를 바꿨을 때, 또는
// 성분 개수가 바뀌어 다시 만들었을 때 "선 색깔 1/2/..." 형태로 번호를
// 붙일지 그냥 "선 색깔"로 둘지 정한다).
function relabelLineColorRows() {
  const rows = lineColorContainer.querySelectorAll(".slider-row");
  rows.forEach((row, idx) => {
    const label = row.querySelector("label");
    label.textContent = rows.length > 1 ? `${t("lineColorLabel")} ${idx + 1}` : t("lineColorLabel");
  });
}

// ---- three.js 기본 세팅 ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131a);

const camera = new THREE.PerspectiveCamera(
  50,
  viewport.clientWidth / viewport.clientHeight,
  0.01,
  200
);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// 회전은 카메라 궤도 대신 직접 매듭(outerGroup)을 돌리는 커스텀 드래그로
// 처리한다 (아래 참고) — 그래야 마우스로 돌린 결과가 X/Y/Z 슬라이더 값과
// 항상 일치한다. 확대/축소(줌)와 오른쪽 버튼 팬은 그대로 OrbitControls에 맡긴다.
controls.enableRotate = false;

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(3, 4, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
fill.position.set(-4, -2, -3);
scene.add(fill);

// outerGroup: 슬라이더로 조작하는 X/Y/Z 회전축
// spinGroup: 자동 회전이 적용되는 축 (outerGroup 안에 중첩되어 서로 다른 축이 동시에 작동)
const outerGroup = new THREE.Group();
const spinGroup = new THREE.Group();
outerGroup.add(spinGroup);
scene.add(outerGroup);

const tubeGroup = new THREE.Group();
const handleGroup = new THREE.Group();
spinGroup.add(tubeGroup, handleGroup);

// ---- 매듭 상태 ----
// knotComponents[c] = { controlPoints: THREE.Vector3[] (로컬 좌표) }
// 제어점을 드래그하거나 추가/삭제하면 이 배열을 직접 수정하고, 화면(튜브/손잡이 점)을
// 다시 그린다. computeKnot() 이 준 매듭 모양은 초기값을 만들 때만 쓰인다.
let knotComponents = [];
let tubeMeshes = []; // 각 mesh.userData = {c} (어느 성분의 튜브인지)
let handleMeshes = []; // 각 mesh.userData = {c, i} (controlPoints[c][i])

function currentTubeRadius() {
  return parseFloat(tubeRadiusInput.value) || 0.05;
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose();
    child.material?.dispose();
    group.remove(child);
  }
}

function buildTubeGeometry(controlPoints, radius) {
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, "centripetal", 0.5);
  const tubularSegments = Math.max(64, controlPoints.length * 8);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, 14, true);
}

// ==== 렌더링 스타일 ====
// "lit"  : 기본 - 금속성/광택이 있는 물리 기반 라이팅 (현재까지의 스타일)
// "toon" : 카툰 - 빛의 영향을 전혀 받지 않는 단색 채우기(=그림자 없음) +
//          검은 테두리 (법선 방향으로 살짝 부풀린 뒷면 메쉬로 구현)
// "flat" : 플랫 - 테두리 없이 단색 무광 (그림자/하이라이트 없음)
function currentRenderStyle() {
  return renderStyleSelect?.value || "lit";
}

function createMainMaterial(color) {
  const style = currentRenderStyle();
  if (style === "toon" || style === "flat") {
    // 카툰/플랫 모두 조명의 영향을 받지 않는 단색(그림자 없음) - 카툰은
    // 여기에 검은 테두리 메쉬가 추가로 덧그려진다는 점만 다르다.
    return new THREE.MeshBasicMaterial({ color });
  }
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.35 });
}

// 카툰 스타일의 검은 테두리: 같은 지오메트리를 뒷면(BackSide)만 그리고,
// 정점을 자신의 법선 방향으로 살짝 밀어 넣어 원래 튜브보다 아주 조금 더
// 크게 만든다 (그러면 앞면 튜브에 가려지고, 실루엣 가장자리만 얇게 남아
// '테두리'처럼 보인다).
const OUTLINE_VERTEX_SHADER = `
  uniform float thickness;
  void main() {
    vec3 expanded = position + normal * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
  }
`;
const OUTLINE_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(0.03, 0.03, 0.045, 1.0);
  }
`;

function createOutlineMesh(geometry, thickness) {
  const material = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness } },
    vertexShader: OUTLINE_VERTEX_SHADER,
    fragmentShader: OUTLINE_FRAGMENT_SHADER,
    side: THREE.BackSide,
  });
  return new THREE.Mesh(geometry, material);
}

function rebuildTubes() {
  clearGroup(tubeGroup);
  tubeMeshes = [];
  const radius = currentTubeRadius();
  const style = currentRenderStyle();

  knotComponents.forEach((comp, c) => {
    const geometry = buildTubeGeometry(comp.controlPoints, radius);
    const material = createMainMaterial(lineColors[c] ?? lineColors[0]);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { c };
    tubeGroup.add(mesh);
    tubeMeshes.push(mesh);

    if (style === "toon") {
      const outline = createOutlineMesh(geometry, radius * 0.18);
      tubeGroup.add(outline);
    }
  });
}

function createHandleMaterial() {
  const style = currentRenderStyle();
  if (style === "toon" || style === "flat") {
    return new THREE.MeshBasicMaterial({ color: currentHandleColor });
  }
  return new THREE.MeshStandardMaterial({
    color: currentHandleColor,
    emissive: 0x554400,
    metalness: 0.1,
    roughness: 0.4,
  });
}

// 손잡이(제어점) 구체를 처음부터 다시 만든다.
// 제어점 개수가 바뀔 때(초기 로드, 점 추가/삭제)만 호출한다.
function rebuildHandles() {
  clearGroup(handleGroup);
  handleMeshes = [];

  const r = currentTubeRadius();
  const style = currentRenderStyle();

  knotComponents.forEach((comp, c) => {
    const pts = comp.controlPoints;
    const n = pts.length;

    // 손잡이 크기는 튜브 반지름 기준으로 살짝 튀어나오게 잡되, 제어점
    // 간격이 촘촘하면(점을 많이 추가한 경우) 서로 겹치지 않도록 그 구간
    // 길이에 맞춰서도 상한을 둔다.
    let totalLen = 0;
    for (let i = 0; i < n; i++) totalLen += pts[i].distanceTo(pts[(i + 1) % n]);
    const avgSeg = n > 0 ? totalLen / n : r;
    const handleR = Math.max(Math.min(r * 1.15, avgSeg * 0.45), 0.004);
    const handleGeom = new THREE.SphereGeometry(handleR, 16, 12);

    for (let i = 0; i < n; i++) {
      const mat = createHandleMaterial();
      const mesh = new THREE.Mesh(handleGeom, mat);
      mesh.position.copy(pts[i]);
      mesh.userData = { kind: "handle", c, i };
      handleGroup.add(mesh);
      handleMeshes.push(mesh);

      if (style === "toon") {
        const outline = createOutlineMesh(handleGeom, handleR * 0.22);
        outline.position.copy(pts[i]);
        handleGroup.add(outline);
      }
    }
  });
}

function updateHandlePositions() {
  for (const mesh of handleMeshes) {
    const { c, i } = mesh.userData;
    mesh.position.copy(knotComponents[c].controlPoints[i]);
  }
}

function fitCameraToObject(object, offset = 1.6) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const fov = (camera.fov * Math.PI) / 180;
  let distance = (maxDim / 2 / Math.tan(fov / 2)) * offset;
  distance = Math.max(distance, 1.0);

  const direction = new THREE.Vector3(0.6, 0.4, 1).normalize();
  camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function setupComponentsFromResult(result) {
  knotComponents = result.components.map((comp) => {
    const points = comp.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", 0.5);
    // 크로싱 방문 횟수에 비례해 제어점 개수를 정한다 (너무 적으면 모양이
    // 뭉개지고, 너무 많으면 드래그하기 번거롭다).
    const numControl = Math.max(10, comp.num_crossings_visited * 3);
    const spaced = curve.getSpacedPoints(numControl);
    // getSpacedPoints 는 닫힌 곡선이라도 마지막에 첫 점과 같은 점을 하나 더
    // 붙여 반환하므로, 우리가 쓰는 '순환 인덱스' 표현과 맞추기 위해 제거한다.
    if (spaced.length > 1 && spaced[0].distanceTo(spaced[spaced.length - 1]) < 1e-6) {
      spaced.pop();
    }
    return { controlPoints: spaced };
  });
}

function rebuildKnot(result) {
  // 이 매듭의 실제 크로싱 간격을 기준으로 계산한 추천 튜브 반지름을
  // 슬라이더에 반영한다 (매듭마다 크기 스케일이 다르므로, 고정된
  // 반지름을 쓰면 촘촘한 매듭에서는 가닥끼리 뭉개져 보인다).
  if (result.suggested_tube_radius) {
    const suggested = result.suggested_tube_radius;
    tubeRadiusInput.min = (suggested * 0.1).toFixed(5);
    tubeRadiusInput.max = (suggested * 1).toFixed(5);
    tubeRadiusInput.step = (suggested * 0.05).toFixed(5);
    tubeRadiusInput.value = suggested.toFixed(5);
  }

  rebuildLineColorInputs(result.num_components);
  setupComponentsFromResult(result);
  rebuildTubes();
  rebuildHandles();
  fitCameraToObject(tubeGroup);
}

function rebuildTubesWithRadius() {
  rebuildTubes();
  rebuildHandles();
}

// ==== 매듭이 스스로를 통과하지 못하게: 두 3D 선분 사이 최단 거리 ====
// (Ericson, "Real-Time Collision Detection"의 표준 세그먼트-세그먼트 거리 알고리즘)
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();

function segmentDistanceSq(p1, p2, p3, p4) {
  _d1.subVectors(p2, p1);
  _d2.subVectors(p4, p3);
  _r.subVectors(p1, p3);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  const EPS = 1e-12;
  let s, t;

  if (a <= EPS && e <= EPS) {
    return p1.distanceToSquared(p3);
  }
  if (a <= EPS) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = _d1.dot(_r);
    if (e <= EPS) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = _d1.dot(_d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }
  _c1.copy(p1).addScaledVector(_d1, s);
  _c2.copy(p3).addScaledVector(_d2, t);
  return _c1.distanceToSquared(_c2);
}

// 드래그 중인 제어점(comp c, index i)이 candidatePos 로 이동했을 때, 그로 인해
// 새로 생기는 두 구간(이전 이웃->i, i->다음 이웃)이 매듭의 다른 부분(자기 자신
// 포함, 링크라면 다른 성분도 포함)과 너무 가까워지는지 검사한다. 같은 성분에서
// 서로 끝점을 공유하는 바로 옆 구간은 원래 붙어 있는 게 정상이므로 검사에서
// 제외한다.
function wouldCollide(c, i, candidatePos, minDist) {
  const pts = knotComponents[c].controlPoints;
  const n = pts.length;
  const prev = (i - 1 + n) % n;
  const next = (i + 1) % n;
  const segA = [pts[prev], candidatePos]; // prev -> i
  const segB = [candidatePos, pts[next]]; // i -> next
  const minDistSq = minDist * minDist;

  for (let cc = 0; cc < knotComponents.length; cc++) {
    const otherPts = knotComponents[cc].controlPoints;
    const m = otherPts.length;
    for (let k = 0; k < m; k++) {
      if (cc === c) {
        // i 자신의 두 구간, 그리고 그와 끝점을 공유하는 바로 옆 구간은 제외
        if (k === prev || k === i || k === (prev - 1 + n) % n || k === next) continue;
      }
      const q1 = otherPts[k];
      const q2 = otherPts[(k + 1) % m];
      if (segmentDistanceSq(segA[0], segA[1], q1, q2) < minDistSq) return true;
      if (segmentDistanceSq(segB[0], segB[1], q1, q2) < minDistSq) return true;
    }
  }
  return false;
}

// lastValidPos(충돌 없음이 보장된 위치)에서 candidatePos(요청한 새 위치)까지
// 직선상에서, 충돌이 시작되기 직전까지 가장 멀리 갈 수 있는 지점을 찾는다.
//
// 주의: candidatePos 자체가 충돌이 아니라고 해서 안전한 건 아니다 — 한 번의
// pointermove 이벤트로 큰 거리를 이동하면(빠른 드래그), 중간에 다른 가닥을
// '뚫고 지나가' 반대편의 충돌 없는 위치에 도착할 수 있다(터널링). 그래서
// 두 끝점만 볼 게 아니라, 이동 거리를 minDist 보다 확실히 촘촘한 간격으로
// 잘게 나눠 순서대로 스캔하면서 충돌이 처음 발생하는 구간을 찾고, 그 구간
// 안에서만 이진 탐색으로 경계를 좁힌다.
function clampAgainstCollision(c, i, lastValidPos, candidatePos, minDist) {
  const totalDist = lastValidPos.distanceTo(candidatePos);
  if (totalDist < 1e-9) return candidatePos.clone();

  const steps = Math.max(8, Math.ceil((totalDist / minDist) * 3));
  const probe = new THREE.Vector3();
  let prevT = 0;

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    probe.lerpVectors(lastValidPos, candidatePos, t);
    if (wouldCollide(c, i, probe, minDist)) {
      let lo = prevT;
      let hi = t;
      for (let iter = 0; iter < 14; iter++) {
        const mid = (lo + hi) / 2;
        probe.lerpVectors(lastValidPos, candidatePos, mid);
        if (wouldCollide(c, i, probe, minDist)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      return new THREE.Vector3().lerpVectors(lastValidPos, candidatePos, lo);
    }
    prevT = t;
  }
  return candidatePos.clone();
}

// ---- UI: PD 코드 렌더링 ----
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
}

// 서버 없이 브라우저에서 직접 계산한다 (knot/compute.js, PD 코드를
// 입력받아 Tutte 임베딩 + 크로싱 z-offset으로 3D 좌표를 만드는 로직을
// 그대로 JS로 옮긴 것).
function renderFromPD(pdText) {
  hideError();
  try {
    const result = computeKnot(pdText);
    rebuildKnot(result);
    showStats(result);
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

// ---- 회전 슬라이더 (여러 축 독립 조작) ----
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function updateManualRotation() {
  outerGroup.rotation.set(
    degToRad(parseFloat(rotX.value)),
    degToRad(parseFloat(rotY.value)),
    degToRad(parseFloat(rotZ.value)),
    "XYZ"
  );
}

// outerGroup.rotation(Euler, 'XYZ' 순서)의 현재 값을 슬라이더에 반영한다.
// 마우스 드래그로 매듭을 돌린 뒤에도 슬라이더가 실제 회전 상태와
// 항상 일치하도록 하기 위함이다.
function syncSlidersFromRotation() {
  rotX.value = normalizeDeg(THREE.MathUtils.radToDeg(outerGroup.rotation.x)).toFixed(1);
  rotY.value = normalizeDeg(THREE.MathUtils.radToDeg(outerGroup.rotation.y)).toFixed(1);
  rotZ.value = normalizeDeg(THREE.MathUtils.radToDeg(outerGroup.rotation.z)).toFixed(1);
}

[rotX, rotY, rotZ].forEach((el) => el.addEventListener("input", updateManualRotation));

resetRotBtn.addEventListener("click", () => {
  rotX.value = 0;
  rotY.value = 0;
  rotZ.value = 0;
  updateManualRotation();
});

tubeRadiusInput.addEventListener("input", rebuildTubesWithRadius);
renderStyleSelect.addEventListener("change", () => {
  rebuildTubes();
  rebuildHandles();
});
handleColorInput.addEventListener("input", () => {
  currentHandleColor = hexInputToInt(handleColorInput);
  rebuildHandles();
});

// ==== 제어점 추가 / 삭제 모드 ====
// "view"   : 기본 - 노란 점을 드래그하면 이동, 빈 곳을 드래그하면 매듭 회전
// "add"    : 매듭(튜브) 위 아무 곳이나 클릭하면 그 자리에 제어점이 추가됨
// "delete" : 노란 점을 클릭하면 그 점이 삭제됨 (단, 삭제로 인해 매듭이
//            스스로를 통과하게 되면 거부한다)
let interactionMode = "view";

function setInteractionMode(next) {
  interactionMode = next;
  addPointBtn.classList.toggle("active", next === "add");
  deletePointBtn.classList.toggle("active", next === "delete");
  if (next === "add") {
    modeHint.textContent = t("modeHintAdd");
  } else if (next === "delete") {
    modeHint.textContent = t("modeHintDelete");
  } else {
    modeHint.textContent = "";
  }
  if (hoveredHandle) {
    setHandleHover(hoveredHandle, false);
    hoveredHandle = null;
  }
}

addPointBtn.addEventListener("click", () => {
  setInteractionMode(interactionMode === "add" ? "view" : "add");
});
deletePointBtn.addEventListener("click", () => {
  setInteractionMode(interactionMode === "delete" ? "view" : "delete");
});

// 폴리라인(제어점을 잇는 꺾은선)에서 localPoint 에 가장 가까운 지점을 찾는다.
// "추가" 모드에서 클릭한 지점을 실제 곡선 위로 스냅시키는 데 쓴다.
function findNearestPointOnPolyline(pts, localPoint) {
  const n = pts.length;
  let best = { distSq: Infinity, segIndex: 0, point: null };
  const ab = new THREE.Vector3();
  const toPoint = new THREE.Vector3();
  const proj = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    ab.subVectors(p2, p1);
    const lenSq = ab.lengthSq();
    toPoint.subVectors(localPoint, p1);
    const t = lenSq > 1e-12 ? THREE.MathUtils.clamp(toPoint.dot(ab) / lenSq, 0, 1) : 0;
    proj.copy(p1).addScaledVector(ab, t);
    const distSq = proj.distanceToSquared(localPoint);
    if (distSq < best.distSq) {
      best = { distSq, segIndex: i, point: proj.clone() };
    }
  }
  return best;
}

function tryAddControlPointAtWorld(worldPoint, compIndex) {
  const comp = knotComponents[compIndex];
  const localPoint = spinGroup.worldToLocal(worldPoint.clone());
  const { segIndex, point } = findNearestPointOnPolyline(comp.controlPoints, localPoint);
  // 이미 곡선 위의 점이므로 충돌 검사 없이 그대로 끼워 넣어도 안전하다.
  comp.controlPoints.splice(segIndex + 1, 0, point);
  rebuildHandles();
  rebuildTubes();
}

// (c, p1)-(p2) 로 이어지는 새 구간이, excludeIndices 로 지정한(원래 있던
// 자기 구간들 제외) 매듭의 다른 부분과 너무 가까워지는지 검사한다.
function wouldSegmentCollide(c, p1, p2, excludeIndices, minDist) {
  const minDistSq = minDist * minDist;
  for (let cc = 0; cc < knotComponents.length; cc++) {
    const pts = knotComponents[cc].controlPoints;
    const m = pts.length;
    for (let k = 0; k < m; k++) {
      if (cc === c && excludeIndices.has(k)) continue;
      const q1 = pts[k];
      const q2 = pts[(k + 1) % m];
      if (segmentDistanceSq(p1, p2, q1, q2) < minDistSq) return true;
    }
  }
  return false;
}

function tryDeleteControlPoint(c, i) {
  const pts = knotComponents[c].controlPoints;
  const n = pts.length;
  if (n <= 4) {
    showError(t("errTooFewPoints"));
    return;
  }
  const prevIdx = (i - 1 + n) % n;
  const nextIdx = (i + 1) % n;
  const prev = pts[prevIdx];
  const next = pts[nextIdx];
  const minDist = currentTubeRadius() * 2 * 1.05;
  // 삭제되는 두 구간(prev->i, i->next)과, 삭제 후 새로 생길 구간(prev->next)의
  // 양 끝을 공유하는 바깥쪽 구간은 '원래 붙어있던 것'이므로 검사에서 뺀다.
  const exclude = new Set([(i - 2 + n) % n, prevIdx, i, nextIdx]);
  if (wouldSegmentCollide(c, prev, next, exclude, minDist)) {
    showError(t("errWouldCollide"));
    return;
  }
  hideError();
  pts.splice(i, 1);
  rebuildHandles();
  rebuildTubes();
}

// ==== 마우스 상호작용: 제어점 드래그 / 추가·삭제 모드 클릭 / (그 외) 매듭 회전 ====
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function setPointerNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

let mode = "none"; // "none" | "rotate" | "point-drag"
let lastPointerX = 0;
let lastPointerY = 0;
const DRAG_ROTATE_SPEED = 0.006;

let dragHandle = null; // 현재 드래그 중인 handle mesh
let dragPlane = new THREE.Plane();
let dragLastValidLocal = new THREE.Vector3();

function setHandleHover(mesh, hovered) {
  const color = interactionMode === "delete" ? HANDLE_DELETE_HOVER_COLOR : HANDLE_HOVER_COLOR;
  mesh.material.color.set(hovered ? color : currentHandleColor);
}

let hoveredHandle = null;

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return; // 왼쪽 버튼만 사용 (오른쪽 버튼은 OrbitControls 팬)
  setPointerNDC(e);
  raycaster.setFromCamera(pointerNDC, camera);

  if (interactionMode === "add") {
    const hit = raycaster.intersectObjects(tubeMeshes)[0];
    if (hit) tryAddControlPointAtWorld(hit.point, hit.object.userData.c);
    return;
  }

  if (interactionMode === "delete") {
    const handleHit = raycaster.intersectObjects(handleMeshes)[0];
    if (handleHit) {
      const { c, i } = handleHit.object.userData;
      tryDeleteControlPoint(c, i);
    }
    return;
  }

  const handleHit = raycaster.intersectObjects(handleMeshes)[0];
  if (handleHit) {
    mode = "point-drag";
    dragHandle = handleHit.object;
    const { c, i } = dragHandle.userData;
    dragLastValidLocal.copy(knotComponents[c].controlPoints[i]);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlane.setFromNormalAndCoplanarPoint(camDir, handleHit.point);
    try {
      renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* 합성 포인터 등 캡처가 불가능한 경우는 무시해도 무방하다 */
    }
    return;
  }

  mode = "rotate";
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener("pointermove", (e) => {
  if (mode === "point-drag" && dragHandle) {
    setPointerNDC(e);
    raycaster.setFromCamera(pointerNDC, camera);
    const worldHit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, worldHit)) return;

    const { c, i } = dragHandle.userData;
    const candidateLocal = spinGroup.worldToLocal(worldHit.clone());
    const minDist = currentTubeRadius() * 2 * 1.05;
    // 드래그되는 점은 다른 가닥과 완전히 붙거나 지나칠 수 없다(크로싱 불변 유지).
    const accepted = clampAgainstCollision(c, i, dragLastValidLocal, candidateLocal, minDist);

    knotComponents[c].controlPoints[i].copy(accepted);
    dragLastValidLocal.copy(accepted);

    updateHandlePositions();
    rebuildTubes();
    return;
  }

  if (mode === "rotate") {
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    // 화면 기준 월드축(Y=위/아래 드래그로 좌우 회전, X=상하 회전)으로
    // 매듭을 직접 돌린다. premultiply 를 쓰므로 항상 월드 좌표계 기준으로
    // 회전이 누적된다 (오브젝트가 어떤 자세든 드래그 방향이 일정하게 느껴짐).
    const qYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      dx * DRAG_ROTATE_SPEED
    );
    const qPitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      dy * DRAG_ROTATE_SPEED
    );
    outerGroup.quaternion.premultiply(qYaw);
    outerGroup.quaternion.premultiply(qPitch);
    syncSlidersFromRotation();
    return;
  }

  if (interactionMode === "add") {
    renderer.domElement.style.cursor = "crosshair";
    return;
  }

  // 드래그 중이 아닐 때: 손잡이 위에 있으면 강조 표시 + 커서 변경
  setPointerNDC(e);
  raycaster.setFromCamera(pointerNDC, camera);
  const handleHit = raycaster.intersectObjects(handleMeshes)[0];

  if (hoveredHandle && hoveredHandle !== handleHit?.object) {
    setHandleHover(hoveredHandle, false);
    hoveredHandle = null;
  }
  if (handleHit) {
    hoveredHandle = handleHit.object;
    setHandleHover(hoveredHandle, true);
    renderer.domElement.style.cursor = interactionMode === "delete" ? "pointer" : "grab";
  } else {
    renderer.domElement.style.cursor = interactionMode === "delete" ? "default" : "grab";
  }
});

function endInteraction(e) {
  mode = "none";
  dragHandle = null;
  if (e && e.pointerId !== undefined && renderer.domElement.hasPointerCapture?.(e.pointerId)) {
    renderer.domElement.releasePointerCapture(e.pointerId);
  }
}
renderer.domElement.addEventListener("pointerup", endInteraction);
renderer.domElement.addEventListener("pointercancel", endInteraction);

// ---- 리사이즈 ----
window.addEventListener("resize", () => {
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
});

// ---- 애니메이션 루프 ----
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (autoRotateCb.checked && mode !== "point-drag") {
    spinGroup.rotation[autoAxisSelect.value] += 0.01;
  }
  renderer.render(scene, camera);
}
animate();

applyLanguage(currentLang);
loadExamples();
