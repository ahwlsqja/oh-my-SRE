# oh-my-SRE SDS

상태: 웹 적용. 기반: 공식 OpenCode UI `a2cb1c4`. 라이트·다크 공통 토큰을 사용하며 실제 TUI 실행기는 미구현이다.

## 1. 정본과 수정 순서

| 계층           | 정본                     | 변경 규칙                                                       |
| -------------- | ------------------------ | --------------------------------------------------------------- |
| 원본 디자인    | `src/sds/upstream/`      | MIT 원본 유지. 임의 편집 금지. 갱신 시 출처와 해시 대조         |
| 제품 의미      | `src/sds/tokens.json`    | 상태·우선순위·명칭·토큰 역할의 유일한 정본                      |
| 웹·터미널 파생 | `src/sds/generated/`     | `pnpm tokens:generate`로 생성. 직접 편집 금지                   |
| React 컴포넌트 | `src/sds/components.tsx` | 원본 data-component 계약과 접근성 동작을 연결                   |
| 이식 차이      | `src/sds/components.css` | React·모바일·제품 의미 차이만 기록                              |
| 제품 배치      | `src/styles.css`         | 화면 배치만 소유. 새 색상 팔레트나 페이지별 상태 체계 추가 금지 |

원본 토큰을 제품 이름으로 바꿔 복제하지 않는다. 제품 역할은 원본 CSS 변수에 연결한다. `tokens:check`는 정본과 생성 결과의 드리프트를 차단하고, `test:sds`는 원본 무수정 해시와 의미 계약을 검증한다.

## 2. 공통 의미와 웹/TUI 매핑

| 상태        | 의미                           | 웹                   | 터미널 표식 |
| ----------- | ------------------------------ | -------------------- | ----------- |
| 판단 대기   | 구체적인 사람 결정 필요        | warning Tag          | `!`         |
| 조사 중     | 읽기 전용 조사 진행            | info Tag             | `>`         |
| 관측 대기   | 근거 부족. 정상·장애 확정 아님 | muted Tag·이력 hatch | `?`         |
| 예산 도달   | 추가 모델 조사 보류            | warning Tag          | `=`         |
| 검토 완료   | 판단 기록 완료. 회복과 별도    | muted Tag            | `v`         |
| 회복 미확인 | 독립 회복 검증 부재            | muted 설명           | `?`         |

우선순위와 상태를 섞지 않는다. P0는 독립적인 중대 영향 근거가 필요하다. 관측 공백·예산 소진을 P0 또는 사람 승인으로 자동 승격하지 않는다.

터미널 팔레트는 동일한 원본 CSS 역할을 해석한 light/dark truecolor 값이다. alpha border는 해당 canvas와 합성해 불투명 색으로 파생한다. ANSI만 가능한 환경은 명칭·ASCII 표식·강조로 의미를 유지해야 한다. 실제 terminal renderer, 키 바인딩, 화면 너비·cell 배치·스크롤은 후속 구현 범위다. 웹 Dialog의 동작이 TUI에도 구현됐다고 주장하지 않는다.

## 3. 핵심 컴포넌트

| 컴포넌트            | 재사용과 규칙                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Button              | OpenCode button-v2 원본 CSS. neutral/contrast/outline/ghost, 24·28·32px. 중요한 행동만 contrast |
| Tag                 | 원본 tag CSS. 상태 의미는 `tokens.json`에서 읽고 색만으로 전달하지 않음                         |
| Dialog              | 원본 overlay·surface·slot 구조. React focus primitive만 별도 연결. Escape·focus trap·복귀 보존  |
| Select              | 원본 select-v2 외관의 네이티브 선택. 키보드·모바일 기본 동작 보존                               |
| Tabs                | 원본 tabs DOM·CSS. 제품 내비게이션은 button group으로 노출. 화면 패널의 선택 의미를 유지        |
| ObservationTimeline | 공통 상태 토큰으로 관측 이력 표현. unknown hatch와 명칭을 유지. 가동률·회복 판정과 별도         |

legacy tabs 역할은 adapter에서 공식 v2 background·border·text 역할에 연결한다. 특히 다크에서 라이트 border가 남지 않아야 한다. Dialog의 case 크기와 React 콘텐츠 stretch는 이식 차이이며 원본 파일을 수정하지 않는다.

## 4. 타입·간격·반응형

Inter 원본을 자체 호스팅한다. 한국어는 시스템 글꼴 fallback, 코드와 ID는 시스템 monospace다. 기본 14px, 컨트롤 13px/20px, Tag 11px, 화면 제목 20px. 간격은 원본 4px grid, 기본 반경 2·4·6px다. 전역 대형 hero나 강조색 관리 카드로 확장하지 않는다.

데스크톱은 compact header·tabs·얇은 행, 모바일은 동일 계층을 세로로 재배치한다. 터치 환경의 행동 영역은 44px 이상이다. 상세 제목은 단어 단위 줄바꿈을 적용한다. focus ring, 명칭, reduced-motion과 색 외 표식을 유지한다.

## 5. 제품 문구

- 권장: `판단 대기`, `조사 중`, `관측 대기`, `미확인 범위`, `예산 도달`, `기록 변경 완료`.
- 행동: `판단 기록`, `보류 기록`, `검토 완료 기록`, `이전 기록 더 보기`.
- 제외: 해요체, 확인되지 않은 `정상`·`복구 완료`, 내부 구현명, 반복되는 정책 안내.
- `DEMO`는 상단 한 곳에 표시한다. 실제 실행이 없는 기록 동작에는 `외부 실행 없음`을 결과로 명시한다.
- API 키·인증·권한 내부 설명은 연결 화면에서만 제공한다.

## 6. 인수와 출처

기존 12개 E2E의 제품 동작을 보존하고 light/dark 전환을 추가 검증한다. 실제 브라우저에서 데스크톱·모바일 이미지와 원본 OpenCode web/TUI 참고의 밀도·컨트롤·구분선을 대조한다. 스크린샷과 비교 JSON은 로컬 QA 산출물이며 공개 참고 이미지·상표를 배포하지 않는다.

정확한 파일·라이선스·변경 범위는 [UPSTREAM.md](UPSTREAM.md), [manifest](upstream-manifest.json), 원본 MIT 및 Inter OFL 고지를 따른다. 전체 OpenCode 패키지·제품 엔진을 사용하는 것은 아니다.
