# oh-my-SRE

**필요한 판단만, 분명하게.**

관측 provider와 모델·agent 실행 provider를 조합하는 범용 SRE 에이전트 엔진을 목표로 합니다. P1/P2는 조사와 사전에 허용된 복구를 자율 처리하고, P0만 사람을 호출하면서 조사를 계속하는 방향입니다. 영구 wiki의 경험을 검색하고 검토·승격된 정적 런북을 typed 인자로 실행하도록 설계합니다. 구체 계약과 첫 구현 범위는 [에이전트 코어 설계](docs/agent-core.md)에 정리했습니다.

**현재는 자체 로컬 worker로 검증한 첫 코어 slice입니다.** 사건·기간별 호출 예산·재조사·journal·등록 런북·독립 probe·Git wiki·P0 로컬 outbox가 동작합니다. 기본 investigator는 합성 fixture입니다. Responses adapter는 로컬 HTTP stub으로 검증했으며 실제 모델·외부 agent runtime·운영 복구·외부 알림은 연결하지 않았습니다.

## 지금 사용할 수 있는 것

- **로컬 엔진:** CLI가 정적 script로 자체 worker를 복구하고 새 HTTP probe로 확인한 뒤 Git wiki에 기록합니다. 다음 사건에서 실제 성공·실패 요약과 승인된 런북을 다시 검색합니다. 화면은 그 실행 기록의 읽기 전용 projection입니다.
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

## 첫 엔진 실행

```sh
pnpm engine:demo
```

저장소 밖 새 private workspace를 만들고 P1 복구·wiki 재사용·P2 중복 억제·P0 page 의도/ACK/조사 지속을 실행합니다. 마지막 JSON에 workspace와 `demo-receipt.json`, `engine-projection.json` 위치가 나옵니다. 입력·investigator·논리 시계는 합성이며 script 적용·로컬 HTTP probe·Git 기록은 실제입니다. 금액이나 token 예산을 집행하지 않으며 예산은 기간별 호출 횟수와 사건별 기간 시도 상한입니다. 실제 token usage는 별도 telemetry로 보존합니다.

```sh
pnpm engine:demo --workspace /path/to/private-workspace --scenario resume
OMS_ENGINE_PROJECTION_PATH=/path/to/private-workspace/engine-projection.json pnpm dev
```

`/?mode=engine`에서 생성 시각과 사건을 읽습니다. 열린 P0는 판단함, P1/P2·종료 사건은 상태에 표시합니다. P0 outbox는 로컬 호출 의도이며 외부 전송이 아닙니다. 화면에서 실행·ACK·모델 호출을 하지 않습니다. 한 번의 CLI 시나리오와 `tick()` API를 제공하며 상시 실행 daemon은 아직 없습니다.

자체 demo workspace의 강제 종료 복구를 시험하려면 새 workspace로 `--scenario crash-after-execute`를 실행합니다. 이 합성 시나리오는 script 적용 직후 자신의 프로세스를 SIGKILL로 끝냅니다. 같은 경로에서 `--scenario resume --recover-stale-lock`로 죽은 PID를 확인한 뒤 잠금을 명시적으로 회수하고 독립 probe로 결과를 대조합니다. 결과가 불명확하면 보류하며 script를 무조건 재실행하지 않습니다.

런북은 운영자가 신뢰하고 승인한 정적 코드입니다. 버전·전체 bundle hash·args subset·effect·target allowlist를 검사하지만 비신뢰 코드를 OS에서 격리하는 sandbox는 아닙니다. 임의 shell·미승격 draft를 실행하지 않습니다. Git wiki는 engine-owned 전용 저장소만 자동 운용하며 source registry를 승격하는 권한은 없습니다.

`OpenAIResponsesInvestigator`는 모델명·HTTPS endpoint·credential resolver·최대 출력/요청/응답 크기/deadline을 명시해 구성하는 단일 비스트리밍 제안 adapter입니다. 공식 [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling)을 따르며 도구의 실제 실행은 broker가 담당합니다. 이번 검증은 합성 키와 localhost stub뿐입니다. 다른 vendor·모든 모델·구독 인증 호환과 실제 live 연결을 주장하지 않습니다. MCP tools schema와 AgentSkills metadata는 같은 런북 정본에서 파생하며 실제 MCP transport/client 연결은 아직 없습니다.

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
pnpm test:core
pnpm build
pnpm exec playwright install chromium
pnpm test
```

이미 설치한 Google Chrome을 쓰려면 `PLAYWRIGHT_CHANNEL=chrome pnpm test`를 실행합니다. E2E는 데스크톱과 모바일 크기의 Chromium에서 필터·상세·더 보기·데모 상태 전이·미확인 보존·키 미수집·외부 API 요청 없음·Escape/포커스 복귀·가로 넘침을 검증합니다. 스크린샷과 실패 trace는 git에 포함하지 않는 `test-results/`에 저장합니다. 라이트·다크 전환도 검증합니다. 실제 모바일 기기나 전체 보조 기술 조합의 인증을 주장하지 않습니다.

## 구조와 다음 경계

- [DESIGN.md](DESIGN.md): 정보 계층·OpenCode 기반 SDS 토큰·반응형·접근성·콘텐츠 원칙.
- [docs/agent-core.md](docs/agent-core.md): 범용 엔진 목표·현재 로컬 slice·provider/권한·예산·wiki·런북·검증 범위.
- [docs/PRD.md](docs/PRD.md): 제품 흐름·공급자 경계·불확실성·승인과 실행의 분리·인수 기준.
- `src/demo.ts`: 새로 작성한 합성 사건과 관측 이력.
- `src/App.tsx`: 판단함·상태·상세·연결 안내.
- `tests/product.spec.ts`: 핵심 사용자 흐름 E2E.

웹과 TUI는 공통 상태·우선순위·명칭과 light/dark 테마 데이터를 공유하도록 설계했습니다. 실제 TUI 실행기·키 바인딩·cell 레이아웃은 아직 구현하지 않았습니다.

외부 관측 시스템·agent CLI·조직 인증·운영 runbook·외부 알림 채널은 후속 범위입니다. 저장소는 단일 owner의 로컬 journal이며 분산 저장·전원 손실을 포함한 exactly-once를 보장하지 않습니다. args JSON Schema는 object+string const subset만 지원하고 다른 형태는 거부합니다. 다중 provider의 상충 관측 조정, 의미 검색, 자동 runbook 승격과 다단계 모델 대화는 아직 없습니다. 구독 인증은 공급자의 공식 경로를 확인한 runtime별 연동이 필요합니다.

## 디자인 시스템과 라이선스

공식 [OpenCode UI](https://github.com/anomalyco/opencode/tree/a2cb1c4e7f7dfff5de7a17b96a12e78b6799ebcb/packages/ui)의 토큰·타입·간격·컴포넌트 CSS를 재사용하고 React에 이식했습니다. Radix Themes 스킨은 제거했습니다. [전용 SDS](docs/sds/README.md)와 [출처·수정 범위](docs/sds/UPSTREAM.md)를 참고하세요. OpenCode 전체 제품이나 원본 Solid 컴포넌트를 실행하는 것은 아닙니다.

프로젝트는 [Apache License 2.0](LICENSE)입니다. OpenCode MIT·Inter OFL·React 및 런타임 의존성의 원본 라이선스·저작권은 [타사 고지](public/THIRD_PARTY_NOTICES.txt)에 보존합니다. `pnpm licenses:generate`로 고지를 재생성하며 정적 빌드에도 포함합니다. Inter 원본과 OFL을 자체 호스팅하고 한국어·코드에는 시스템 글꼴 fallback을 사용합니다. 로고·상표·원본 참고 스크린샷은 포함하지 않습니다.
