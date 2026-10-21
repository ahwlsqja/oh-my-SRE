/*
 * 행동 목록 (구현 전 고정)
 * 1. 저장소 밖 고정 일반 파일의 strict projection만 로컬 GET으로 제공한다.
 *    상한·심볼릭 링크·미지 필드·Host/Origin·query·POST 거부를 계약 테스트로 검증한다.
 * 2. 로컬 엔진 snapshot은 P0 판단함과 나머지 상태를 나누고 로컬 범위를 표시한다.
 *    합성 investigator·호출 예산·outbox ACK·회복 범위·모바일 overflow를 검증한다.
 * 3. 재조회 실패 또는 잘못된 projection은 기존 snapshot과 합성 예시로 대체하지 않는다.
 *    출처 선택과 읽기 전용 동작을 desktop/mobile에서 검증한다.
 */
import { test, expect } from "@playwright/test";
import type { EngineProjection } from "../server/engine-provider.mjs";

const digest = (letter: string) => letter.repeat(64);
const projection = (): EngineProjection => ({
  kind: "local_engine",
  scope: "local_demo",
  investigator: "fixture",
  observedAt: "2026-01-01T12:00:00.000Z",
  incidents: [
    {
      id: digest("a"),
      resourceKey: "synthetic-worker-p0",
      failureClass: "probe_failed",
      episode: 1,
      revision: 2,
      severity: "P0",
      evidenceState: "complete",
      status: "open",
      investigation: "running",
      attempts: 2,
      periodAttempts: 1,
      dueAt: 1767268800000,
      recovery: "unverified",
      knowledgeHits: 1,
    },
    {
      id: digest("b"),
      resourceKey: "synthetic-worker-p1",
      failureClass: "probe_failed",
      episode: 1,
      revision: 1,
      severity: "P1",
      evidenceState: "partial",
      status: "open",
      investigation: "budget_paused",
      attempts: 1,
      periodAttempts: 0,
      dueAt: 1767268800000,
      recovery: "unverified",
      knowledgeHits: 0,
    },
    {
      id: digest("c"),
      resourceKey: "synthetic-worker-p2",
      failureClass: "probe_failed",
      episode: 1,
      revision: 3,
      severity: "P2",
      evidenceState: "complete",
      status: "resolved",
      investigation: "completed",
      attempts: 2,
      periodAttempts: 1,
      dueAt: 1767268800000,
      recovery: "verified",
      knowledgeHits: 1,
    },
    {
      id: digest("d"),
      resourceKey: "synthetic-worker-p0-closed",
      failureClass: "probe_failed",
      episode: 1,
      revision: 3,
      severity: "P0",
      evidenceState: "stale",
      status: "resolved",
      investigation: "__proto__",
      attempts: 2,
      periodAttempts: 0,
      dueAt: 1767268800000,
      recovery: "verified",
      knowledgeHits: 0,
    },
  ],
  pages: [
    {
      key: digest("e"),
      incidentId: digest("a"),
      episode: 1,
      revision: 2,
      state: "pending",
      recoveryUpdate: false,
    },
    {
      key: digest("f"),
      incidentId: digest("c"),
      episode: 1,
      revision: 3,
      state: "acked",
      ackedBy: "synthetic-reader",
      recoveryUpdate: true,
    },
  ],
  effects: [
    {
      id: digest("a"),
      incidentId: digest("a"),
      revision: 2,
      resourceKey: "synthetic-worker-p0",
      state: "outcome_unknown",
      runbookRef: { id: "synthetic-restart", version: "1", digest: digest("b") },
      startedAt: 1767268800000,
      reconcileDueAt: 1767268860000,
    },
    {
      id: digest("b"),
      incidentId: digest("c"),
      revision: 3,
      resourceKey: "synthetic-worker-p2",
      state: "verified",
      runbookRef: { id: "synthetic-restart", version: "1", digest: digest("b") },
      startedAt: 1767268800000,
      verifiedAt: 1767268860000,
      proofDigest: digest("c"),
    },
  ],
  budgets: { "1767268800000": { reserved: 1, spent: 3 } },
  auditCount: 8,
});

test("로컬 엔진은 P0 판단함과 사건 상태를 나누고 범위·생성 시각을 표시한다", async ({
  page,
}, testInfo) => {
  await page.route("**/api/engine", (route) => route.fulfill({ json: projection() }));
  await page.goto("/");
  await page.getByRole("combobox", { name: "자료 출처" }).selectOption("engine");
  await expect(page).toHaveURL(/mode=engine/);
  await expect(page.getByRole("heading", { name: "로컬 엔진", exact: true })).toBeVisible();
  await expect(page.getByText("합성 조사기", { exact: true })).toBeVisible();
  await expect(
    page.locator(".engine-context time[datetime='2026-01-01T12:00:00.000Z']"),
  ).toBeVisible();
  const inbox = page.getByRole("region", { name: "판단함" });
  const status = page.getByRole("region", { name: "사건 상태" });
  await expect(inbox).toContainText("synthetic-worker-p0");
  await expect(inbox).toContainText("조사 중");
  await expect(inbox).toContainText("probe_failed");
  await expect(inbox).not.toContainText("synthetic-worker-p1");
  await expect(inbox).not.toContainText("synthetic-worker-p0-closed");
  await expect(status).toContainText("synthetic-worker-p1");
  await expect(status).toContainText("synthetic-worker-p2");
  await expect(status).toContainText("종료");
  await expect(status).toContainText("조사 상태 확인 필요");
  await expect(page.locator(".engine-record")).not.toHaveAttribute("open");
  await expect(page.getByRole("region", { name: "호출 예산" })).not.toBeVisible();
  await expect(page.locator("body")).not.toContainText("실모델 live");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("engine.png"), fullPage: true });
  await page.locator(".engine-record > summary").click();
  await expect(
    page.getByText("근거 완비는 서비스 정상 판정과 별도.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("자체 로컬 worker");
  await expect(page.locator("body")).toContainText("입력 fixture 여부 미제공");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("engine-record.png"), fullPage: true });
});

test("호출 예산·로컬 outbox·실행 결과는 읽기 전용 상태로 표시한다", async ({ page }) => {
  const writes: string[] = [];
  const input = projection();
  input.investigator = "openai_responses";
  page.on("request", (req) => {
    if (req.method() !== "GET") writes.push(req.method());
  });
  await page.route("**/api/engine", (route) => route.fulfill({ json: input }));
  await page.goto("/?mode=engine");
  await expect(page.getByText("Responses 어댑터", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("합성 조사기");
  await page.locator(".engine-record > summary").click();
  await expect(page.getByRole("region", { name: "호출 예산" })).toContainText("예약 1회");
  await expect(page.getByRole("region", { name: "호출 예산" })).toContainText("사용 3회");
  await expect(page.getByRole("region", { name: "로컬 outbox" })).toContainText("ACK 대기");
  await expect(page.getByRole("region", { name: "로컬 outbox" })).toContainText("ACK 기록");
  await expect(page.getByRole("region", { name: "실행 상태" })).toContainText("결과 불명");
  await expect(page.getByRole("region", { name: "실행 상태" })).toContainText("로컬 probe 확인");
  await expect(page.getByRole("button", { name: /ACK|실행|판단 기록/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/USD|토큰 사용|\$0/);
  await page.getByRole("button", { name: "다시 읽기" }).click();
  await expect(page.locator(".engine-record")).toBeVisible();
  await page.locator(".engine-record > summary").click();
  await expect(page.getByRole("region", { name: "로컬 outbox" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("재조회 실패와 잘못된 응답은 이전 snapshot이나 합성 사건으로 대체하지 않는다", async ({
  page,
}) => {
  let result: unknown = projection();
  let status = 200;
  await page.route("**/api/engine", (route) => route.fulfill({ status, json: result }));
  await page.goto("/?mode=engine");
  await expect(page.getByRole("region", { name: "판단함" })).toBeVisible();
  status = 503;
  result = { error: "engine_unavailable" };
  await page.getByRole("button", { name: "다시 읽기" }).click();
  await expect(page.getByRole("alert")).toContainText("엔진 snapshot을 읽을 수 없음");
  await expect(page.getByRole("region", { name: "판단함" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/synthetic-worker|이벤트 처리 지연|DEMO/);
  status = 200;
  result = { kind: "local_engine", incidents: null };
  await page.getByRole("button", { name: "다시 읽기" }).click();
  await expect(page.getByRole("alert")).toContainText("엔진 snapshot을 읽을 수 없음");
  await expect(page.locator("body")).not.toContainText("이벤트 처리 지연");
});
