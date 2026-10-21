import { test, expect } from "@playwright/test";

const snapshot = () => ({
  version: 1,
  capturedAt: new Date().toISOString(),
  receipts: [
    {
      sourceKind: "deployment_readback",
      claim: "deployment_binding",
      verdict: "verified",
      observedAt: new Date(Date.now() - 1000).toISOString(),
      ttlSeconds: 300,
      scopeDigest: "a".repeat(64),
      evidenceDigest: "b".repeat(64),
      coverage: "scoped",
      limitations: ["service_health_unverified"],
      counters: { checksPassed: 5 },
      window: {
        start: new Date(Date.now() - 3600000).toISOString(),
        end: new Date(Date.now() - 1800000).toISOString(),
      },
    },
  ],
});

test("실제 snapshot 모드는 시각과 범위를 표시하고 합성 사건·이력을 섞지 않는다", async ({
  page,
}, testInfo) => {
  await page.route("**/api/receipts", (route) => route.fulfill({ json: snapshot() }));
  await page.goto("/?mode=receipt");
  await expect(page.getByRole("heading", { name: "근거 스냅샷" })).toBeVisible();
  await expect(page.getByText("단계 확인", { exact: true })).toBeVisible();
  await expect(page.getByText("원천 관측", { exact: true })).toBeVisible();
  await expect(page.getByText("TTL 300초", { exact: true })).toBeVisible();
  await expect(page.getByText("집계 창", { exact: true })).toBeVisible();
  await expect(page.getByText("기간별 이력 미제공", { exact: true })).toBeVisible();
  for (const pattern of [
    /DEMO/,
    /\$0\.18/,
    /10:12/,
    /이벤트 처리 지연/,
    /검색 서비스/,
    /90일 예시/,
  ]) {
    await expect(page.locator("body")).not.toContainText(pattern);
  }
  await expect(page.locator(".uptime-bar")).toHaveCount(0);
  await expect(page.getByText("사건 · 비용 · 모델 실행 미제공", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("receipt.png"), fullPage: true });
});

test("오류와 오래된 근거는 DEMO나 정상으로 전환되지 않는다", async ({ page }) => {
  await page.route("**/api/receipts", (route) =>
    route.fulfill({ status: 503, json: { error: "receipt_unavailable" } }),
  );
  await page.goto("/?mode=receipt");
  await expect(page.getByRole("alert")).toContainText("근거를 읽을 수 없음");
  await expect(page.locator("body")).not.toContainText("이벤트 처리 지연");
  const stale = snapshot();
  stale.receipts[0].observedAt = "2020-01-01T00:00:00.000Z";
  stale.receipts[0].window = { start: "2019-12-31T22:00:00.000Z", end: "2019-12-31T23:00:00.000Z" };
  await page.unroute("**/api/receipts");
  await page.route("**/api/receipts", (route) => route.fulfill({ json: stale }));
  await page.getByRole("button", { name: "다시 읽기" }).click();
  await expect(page.getByText("오래된 근거", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("단계 확인");
});
