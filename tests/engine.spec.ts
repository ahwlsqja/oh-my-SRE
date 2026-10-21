/*
 * 행동 목록 (구현 전 고정)
 * 1. 저장소 밖 고정 일반 파일의 strict projection만 로컬 GET으로 제공한다.
 *    상한·심볼릭 링크·미지 필드·Host/Origin·query·POST 거부를 계약 테스트로 검증한다.
 * 2. 로컬 엔진 snapshot은 P0 판단함과 나머지 상태를 나누고 로컬 범위를 표시한다.
 *    합성 investigator·호출 예산·outbox ACK·회복 범위·모바일 overflow를 검증한다.
 * 3. 재조회 실패 또는 잘못된 projection은 기존 snapshot과 합성 예시로 대체하지 않는다.
 *    출처 선택과 읽기 전용 동작을 desktop/mobile에서 검증한다.
 */
