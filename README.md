# 3D 매듭 뷰어 (정적 JS 버전)

`project1`(Flask + Python 서버 버전)과 기능은 동일하지만, PD 코드 계산
로직(`knot/*.py`)을 전부 JavaScript로 옮겨서 **서버 없이 브라우저에서만**
동작하는 버전입니다. 그래서 GitHub Pages 같은 정적 호스팅에 그대로
올릴 수 있습니다.

## 로컬에서 미리보기

정적 파일이라 그냥 더블클릭(`file://`)으로 열면 ES 모듈(import) 때문에
브라우저가 막습니다. 아무 로컬 서버로 열어야 합니다:

```bash
cd project1-js
python3 -m http.server 5050
```

그 다음 브라우저에서 http://127.0.0.1:5050 접속.

## GitHub Pages에 올리기

1. 이 폴더(`project1-js`)를 GitHub 저장소 루트(또는 `/docs` 폴더)로 push
2. 저장소 Settings → Pages → Branch에서 해당 브랜치/폴더 선택
3. 몇 분 뒤 `https://아이디.github.io/저장소이름` 으로 접속 가능

## 페이지

- `index.html` — 3D 뷰어 (제어점 드래그, 점 추가/삭제, 색상 등)
- `2d.html` — 2D 다이어그램 편집기. 제어점과 그 사이의 arc를 드래그해서 모양을 바꾸고
  (잡은 쪽이 위로 넘어가고, Shift를 누르면 아래로 지나감 — 매듭 종류는 바뀌지 않음),
  180° 회전(세로축 기준)과 거울상, 크로싱 간격·선 굵기 조절이 가능합니다.
  두 페이지는 서로 링크로 오갈 수 있고 언어 설정을 공유합니다.

## 구조

- `index.html`, `style.css`, `main.js` — 화면/상호작용(Three.js). `project1`의
  같은 파일과 거의 동일하고, PD 코드를 계산하는 두 함수(`renderFromPD`,
  `loadExamples`)만 `fetch("/api/...")` 대신 아래 `knot/` 모듈을 직접
  호출하도록 바뀌었습니다.
- `knot/` — `project1/knot/*.py`를 그대로 옮긴 JS 모듈들
  (`pdParser.js`, `graph.js`, `linalg.js`, `embedding.js`, `traversal.js`,
  `curve.js`, `compute.js`, `examples.js`). numpy 선형대수(`np.linalg.solve`)는
  `linalg.js`에 작은 가우스 소거법으로 새로 구현했습니다.
- `knot/diagram2d.js` — `project1/knot/diagram2d.py`를 옮긴 것. 2D 다이어그램용 곡선
  (크로싱에서 두 가닥이 수직으로 만나는 에르미트 곡선)을 만듭니다.
- `2d.html`, `2d.js`, `knot2d-core.js` — 2D 편집기. `project1/static`의 같은 파일과
  동일하고, `2d.js`에서 서버 호출(`fetch("/api/knot2d")`) 대신 `computeDiagram2d()`를
  직접 부르는 부분만 다릅니다. `knot2d-core.js`는 화면과 무관한 순수 계산
  (곡선, 충돌 검사, 점 이동/추가/삭제)이라 그대로 복사해 쓰면 됩니다.

`project1`의 파이썬 코드를 고치면 이 폴더의 JS는 자동으로 따라가지
않습니다 — 로직을 바꿀 때는 양쪽에 같이 반영해야 합니다.
