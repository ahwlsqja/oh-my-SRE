# 합성 demo worker 복구

운영자가 신뢰하고 사전 승인한 로컬 예제 코드다. sandbox를 구현하지 않는다. 비신뢰 draft는 실행하지 않는다.

입력은 고정 `workerId`이며 workspace·operation ID는 broker가 제공한다. 자체 생성한 `worker.json`만 교체하고 같은 operation을 다시 적용하지 않는다. 정상 exit와 회복 판정은 별도이며 broker가 새 HTTP probe로 확인한다. 실제 운영 runbook이나 production 기본 timeout을 뜻하지 않는다.
