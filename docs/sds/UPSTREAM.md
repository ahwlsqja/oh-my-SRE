# OpenCode 출처와 재사용 경계

공식 [opencode.ai](https://opencode.ai)의 GitHub 링크가 가리키는 저장소는 [anomalyco/opencode](https://github.com/anomalyco/opencode)다.

- 기준 커밋: [`a2cb1c4e7f7dfff5de7a17b96a12e78b6799ebcb`](https://github.com/anomalyco/opencode/tree/a2cb1c4e7f7dfff5de7a17b96a12e78b6799ebcb).
- UI 패키지 라이선스: MIT, Copyright (c) 2025 opencode.
- 웹: SolidJS. 터미널: OpenTUI와 Solid. 현재 제품은 React/Vite를 유지한다.
- 제품명·로고·상표를 재사용하지 않는다. 공식 스크린샷은 로컬 비교 자료이며 배포하지 않는다.

## 원본과 이식

`src/sds/upstream/`은 아래 MIT 원본의 필요한 디자인 파일을 보존한다. `src/sds/components.tsx`는 원본의 data-component/data-slot 계약과 CSS를 사용하는 새 React 구현이다. 원본 Solid TSX를 실행하거나 패키지 전체를 사용하는 것은 아니다.

| 원본 경로: packages/ui/src/ 아래                  | 재사용                              |
| ------------------------------------------------- | ----------------------------------- |
| styles/tokens/index.css, colors.css, theme.css    | 전체 시맨틱 색·light/dark 테마 원본 |
| styles/theme.css                                  | 타입·간격·반경·공통 역할 원본       |
| styles/base.css                                   | 기본 reset 원본                     |
| actions/button/button.css, actions/submit.css     | 버튼 외관 원본                      |
| data-display/badge/badge.css                      | Tag 외관 원본                       |
| overlays/dialog/dialog.css                        | Dialog 표면 원본                    |
| forms/select/select.css, navigation/menu/menu.css | 선택 컨트롤 외관 원본               |
| navigation/tabs/tabs.css                          | 탭·내비게이션 표현 원본             |

가져온 파일은 원본 내용의 SHA-256을 manifest에 기록한다. 제품 특화 차이는 `tokens.json`, 생성된 토큰, `components.css`, 앱 레이아웃에서 관리한다. 수정한 원본이 생기면 manifest와 이 문서에 차이를 명시한다.

## 글꼴과 아이콘

웹 본문은 원본 Inter 바이너리를 변경 없이 사용하고 SIL OFL 1.1 고지를 동봉한다. 한국어는 운영체제 글꼴로 fallback한다. 코드와 터미널은 시스템 고정폭 글꼴을 사용한다. JetBrains Nerd Font와 IBM Plex 자산은 이번 배포에 포함하지 않는다.

제품 아이콘은 기존 공개 프로젝트의 자체 SVG를 유지한다. 출처가 다른 파일·공급자 로고와 sprite를 일괄 복사하지 않는다.

## 원본과 다른 부분

- React의 focus·dismiss·포커스 복귀는 별도 Dialog primitive를 사용한다. 표면은 OpenCode CSS 계약을 따른다.
- 선택 컨트롤은 같은 외관의 네이티브 select로 이식해 모바일과 키보드 동작을 보존한다.
- 작은 컨트롤의 시각 높이는 원본을 유지하되 터치 환경에서 최소 44px 영역을 확보한다.
- 웹 라이트를 우선 인수하고 dark 토큰·터미널 파생은 계약으로 검증한다. 실제 TUI 렌더러와 모든 dark 화면 조합은 인수 범위 밖이다.
