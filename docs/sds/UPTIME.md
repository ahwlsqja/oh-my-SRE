# UptimeTimeline 상태 이력

`src/sds/UptimeTimeline.tsx`는 서비스명·현재 상태·날짜별 세로 막대·기간/가동률 footer를 제공하는 공통 React 컴포넌트다. OpenCode SDS의 색·타입을 유지하고, 날짜·일별 상태·미확인·부분기간을 입력으로 받는다.

## 출처 판단

공식 [Anthropic](https://www.anthropic.com/)이 연결하는 [Claude Status](https://status.claude.com/)는 Statuspage HTML 표식과 Atlassian 전용 약관 링크가 있는 서비스다. [공식 embed 문서](https://support.atlassian.com/statuspage/docs/build-your-own-status-embed/)의 상태 위젯은 외부 상태 피드용이며, 확인한 공식 `@statuspage/status-widget`은 이 90일 막대 패턴의 React drop-in이 아니다.

해당 패턴의 직접 재사용 가능한 OSS 컴포넌트는 제한된 조사에서 확인하지 못했다. 원본 HTML·CSS·자산을 복사하지 않고 배치·동작을 새로 작성했다. 기존 프로젝트의 Apache-2.0을 적용하며 외부 패키지·상태 API 호출은 추가하지 않는다.

## 입력과 의미

- `name`, `currentStatus`: 서비스명과 현재 상태. 이력의 과거 상태와 분리한다.
- `days`: 날짜 오름차순의 연속된 일별 입력. 누락일은 `unknown`으로 명시한다.
- `date`: UTC 날짜 `YYYY-MM-DD`.
- `state`: `observed`(관측 확인), `partial`, `error`(오류 신호), `unknown`. 서비스 가용성으로 자동 변환하지 않는다.
- `windowMinutes`: 해당 날짜의 포함 기간 0~1440분. 부분기간의 미포함 영역은 hatch로 구분한다.
- `availability?`: 명시적 `knownMinutes`, `availableMinutes`. `0 ≤ 가용 ≤ 확인 ≤ 포함기간`을 만족해야 한다.
- `kind`: `synthetic` 또는 `measured`. 합성 입력의 비율은 예시 가동률로 표시한다.
- `detail?`: 현재 조사·미확인 범위. 날짜별 상세에서 현재 정보임을 구분해 표시한다.

가동률은 모든 날짜가 1440분이고 범위 전체의 확인 시간이 입증될 때만 `가용/확인` 비율로 표시한다. 자료 부재·unknown·부분 측정·부분 날짜에는 **가동률 미확인**을 유지한다. 확인 구간의 100%를 전체 기간의 100%로 승격하지 않는다.

현재 데모는 90일의 별도 합성 관측 fixture다. 서비스 가용성 근거를 넣지 않았으므로 백분율이 표시되지 않는다. 초록 막대도 서비스 정상이나 uptime의 근거가 아니다.

## 일별 상세와 검증

hover로 날짜별 상세를 보고, 키보드로는 그래프당 하나의 range control에 진입한다. 좌우 방향키·Home·End로 날짜를 선택한다. 좁은 막대 90개를 개별 Tab 대상으로 만들지 않는다. 터치에서도 같은 range control을 사용할 수 있다. 현재 날짜는 데모 기준일이며 실제 운영 측정이 아니다.

`pnpm test:uptime`은 분모·unknown·부분기간·입력 경계를 검증한다. 브라우저 E2E는 90개 막대, 날짜 순서, hover/focus, 부분기간 정보, 모바일·라이트/다크와 기존 제품 흐름을 검증한다.
