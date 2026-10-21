# 첫 코어 slice의 검증 목록

대상은 자체 생성한 로컬 demo worker다. Investigator는 합성 fixture이며 실제 LLM·운영 복구·외부 알림은 연결하지 않는다.

- [x] 설치 정책은 신뢰 원천·심각도 매핑·명시 예산·런북 allowlist를 검증한다.
- [x] journal은 단일 owner·flush·재생·손상 거부를 제공한다.
- [x] canonical 런북은 승격된 version/hash·JSON Schema·고정 entrypoint만 허용한다.
- [x] broker는 권한·typed args·범위·사전조건을 검사한 뒤 정적 script를 실행하고 독립 probe로 검증한다.
- [x] wiki는 Git/Markdown으로 성공·실패 근거를 멱등 기록하고 재검색하며 draft를 승격하지 않는다.
- [x] P1/P2는 자율 처리하고 같은 입력·같은 의미의 poll은 중복 조사·실행을 만들지 않는다.
- [x] 의미 변화·지속 dueAt·기간 예산·시도·deadline·늦은 모델 결과를 구분한다.
- [x] P0 page는 모델과 예산에 종속되지 않고 ACK 뒤에도 조사를 계속한다.
- [x] 효과 직전/직후 중단과 재시작은 unknown을 보존하고 blind retry 없이 대조한다.
- [x] MCP tool schema와 AgentSkills metadata는 같은 정본에서 파생되고 호출은 broker를 거친다.
- [x] 실제 CLI demo가 P1 복구·P2 중복 억제·P0 page/조사·재시작 대조·wiki 재사용을 보여준다.

각 동작은 실패 테스트→최소 구현→통과 커밋으로 진행한다. 마지막에 기존 계약·GUI·타입·린트·포맷·빌드와 공개 범위를 검증한다.

외부 모델 adapter는 공식 Responses wire의 localhost stub 계약만 검증했다. 실제 모델·운영 effect·외부 page·MCP transport·범용 sandbox 완료를 뜻하지 않는다. 예산은 호출 횟수·기간 시도이고 token usage는 telemetry다.
