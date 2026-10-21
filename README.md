# oh-my-SRE

**필요한 판단만, 분명하게.**

관측 provider와 모델·agent 실행 provider를 조합하는 범용 SRE 에이전트 엔진을 목표로 합니다. P1/P2는 조사와 사전에 허용된 복구를 자율 처리하고, P0만 사람을 호출하면서 조사를 계속하는 방향입니다. 영구 wiki의 경험을 검색하고 검토·승격된 정적 런북을 typed 인자로 실행하도록 설계합니다. 구체 계약과 첫 구현 범위는 [에이전트 코어 설계](docs/agent-core.md)에 정리했습니다.

**현재 구현은 UI/SDS와 읽기 전용 receipt 스냅샷 provider입니다. 실제 agent loop·모델/runtime provider·지속 사건 엔진·자동 복구·외부 알림은 아직 없습니다.** 기본 화면은 합성 데모이며 별도 스냅샷 모드는 저장소 밖 파일의 단계별 근거를 표시합니다.

## 지금 사용할 수 있는 것

- **판단함:** 구체적인 사람 결정이 있는 사건을 먼저 표시하고 조사 상태·전체 목록으로 필터링합니다.
- **사건 상세:** 상황·확인·미확인·다음 행동·필요한 결정, 근거, 모델별 합성 기록, 최신 이력과 과거 더 보기.
- **상태:** 서비스별 관측 상태·90일 예시 이력·일별 상세·에이전트의 예시 행동·미확인 범위. 관측 도착을 서비스 정상이나 회복으로 확정하지 않습니다.
- **데모 판단:** 보류·검토 완료를 현재 브라우저 메모리에 기록합니다. 실제 승인·권한 발급·복구·외부 전송은 일어나지 않습니다. 새로고침하면 초기화됩니다.
- **연결 안내:** 관측 도구·모델·인증을 나눠 설명합니다. 공급자 선택은 안내만 바꾸며 키를 받거나 저장하지 않습니다.

## 로컬 실행

Node.js 22.12 이상과 pnpm 10.33을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

기본 주소는 `http://127.0.0.1:5173`입니다. 정적 배포용 결과는 `pnpm build`로 `dist/`에 생성합니다. 실제 운영 연결과 호스팅은 별도 설정이 필요합니다.

## 근거 스냅샷

서버 실행 환경의 `OMS_RECEIPT_PATH`를 저장소 밖 JSON 일반 파일의 절대 경로로 지정하고 `pnpm dev` 또는 `pnpm preview`를 실행합니다. 화면 하단의 자료 출처를 바꾸거나 `/?mode=receipt`로 엽니다. 이 endpoint는 Vite 개발·preview 서버에서만 제공하며 정적 호스팅에는 포함되지 않습니다.

- `/api/receipts`는 고정 파일만 읽는 GET입니다. 최대 128 KiB, 엄격한 키·타입·enum, 로컬 Host와 같은 Origin을 검사합니다. 쿼리로 파일을 선택하거나 CORS로 다른 출처에서 읽을 수 없습니다.
- 원래 `observedAt`부터 TTL을 계산합니다. 파일을 다시 읽거나 `capturedAt`을 바꿔도 만료가 연장되지 않습니다. 미래 시각과 1초 미만·24시간 초과 TTL은 거부합니다.
- 단계 확인은 전체 서비스 정상·무유실·회복을 뜻하지 않습니다. Raw 집계, Flink/Fact, 제품 HTTP 응답, SRE 운영 HTTP 응답은 별도 claim입니다.
- 사건·비용·모델 실행·기간별 이력이 없으면 미제공으로 표시합니다. 읽기 실패 때도 합성 예시로 자동 전환하지 않습니다.
- 브라우저는 자격증명 없이 같은 출처의 로컬 endpoint만 읽습니다. 이 provider에는 운영 API proxy·직접 DB 연결·자격증명 수집이 없습니다.

입력 예제는 완전한 합성 자료인 [receipt.example.json](docs/receipt.example.json), 허용 계약은 [receipt.ts](src/providers/receipt.ts)입니다. 원문·운영 주소·고객 식별자·자격증명은 파일에 넣지 않습니다. 파일은 비공개 디렉터리에 두고 원천·범위·정규화 과정을 별도로 보관하세요. source/evidence digest는 추적용이며 서명이나 원천의 진위를 검증하지 않습니다.

## 검증

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm tokens:check
pnpm test:sds
pnpm test:uptime
pnpm test:receipt
pnpm build
pnpm exec playwright install chromium
pnpm test
```

이미 설치한 Google Chrome을 쓰려면 `PLAYWRIGHT_CHANNEL=chrome pnpm test`를 실행합니다. E2E는 데스크톱과 모바일 크기의 Chromium에서 필터·상세·더 보기·데모 상태 전이·미확인 보존·키 미수집·외부 API 요청 없음·Escape/포커스 복귀·가로 넘침을 검증합니다. 스크린샷과 실패 trace는 git에 포함하지 않는 `test-results/`에 저장합니다. 라이트·다크 전환도 검증합니다. 실제 모바일 기기나 전체 보조 기술 조합의 인증을 주장하지 않습니다.

## 구조와 다음 경계

- [DESIGN.md](DESIGN.md): 정보 계층·OpenCode 기반 SDS 토큰·반응형·접근성·콘텐츠 원칙.
- [docs/agent-core.md](docs/agent-core.md): 범용 엔진 목표·provider/권한·예산·재조사·알림·지속 상태·첫 구현 인수. 설계 초안이며 미구현입니다.
- [docs/PRD.md](docs/PRD.md): 제품 흐름·공급자 경계·불확실성·승인과 실행의 분리·인수 기준.
- `src/demo.ts`: 새로 작성한 합성 사건과 관측 이력.
- `src/App.tsx`: 판단함·상태·상세·연결 안내.
- `tests/product.spec.ts`: 핵심 사용자 흐름 E2E.

웹과 TUI는 공통 상태·우선순위·명칭과 light/dark 테마 데이터를 공유하도록 설계했습니다. 실제 TUI 실행기·키 바인딩·cell 레이아웃은 아직 구현하지 않았습니다.

실제 수집 어댑터, 추론·에이전트 실행, 조직 인증, 영속 저장, 알림, 승인 감사와 복구 실행은 **아직 구현하지 않았습니다**. 장기사건 재조사·중복 알림 억제의 서버 정책도 화면 설명과 별개의 후속 범위입니다. 구독 로그인은 공급자가 공식 지원하는 경로와 조건을 검증한 뒤 별도로 설계해야 합니다.

## 디자인 시스템과 라이선스

공식 [OpenCode UI](https://github.com/anomalyco/opencode/tree/a2cb1c4e7f7dfff5de7a17b96a12e78b6799ebcb/packages/ui)의 토큰·타입·간격·컴포넌트 CSS를 재사용하고 React에 이식했습니다. Radix Themes 스킨은 제거했습니다. [전용 SDS](docs/sds/README.md)와 [출처·수정 범위](docs/sds/UPSTREAM.md)를 참고하세요. OpenCode 전체 제품이나 원본 Solid 컴포넌트를 실행하는 것은 아닙니다.

프로젝트는 [Apache License 2.0](LICENSE)입니다. OpenCode MIT·Inter OFL·React 및 런타임 의존성의 원본 라이선스·저작권은 [타사 고지](public/THIRD_PARTY_NOTICES.txt)에 보존합니다. `pnpm licenses:generate`로 고지를 재생성하며 정적 빌드에도 포함합니다. Inter 원본과 OFL을 자체 호스팅하고 한국어·코드에는 시스템 글꼴 fallback을 사용합니다. 로고·상표·원본 참고 스크린샷은 포함하지 않습니다.
