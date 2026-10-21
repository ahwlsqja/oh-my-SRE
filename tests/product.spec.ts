import { expect, test } from "@playwright/test";

test("근거 있는 사람 판단을 먼저 보여주고 미확인 사건은 구분한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "지금 필요한 판단" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /다음 수집 결과를 기다리고 있어요/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /조사 상태/ }).click();
  await expect(
    page.getByRole("button", { name: /다음 수집 결과를 기다리고 있어요/ }),
  ).toBeVisible();
  await expect(page.getByText("예산 대기", { exact: true })).toBeVisible();
});

test("사건 상세는 최신 근거와 과거 기록을 나누고 Escape 뒤 포커스를 복귀한다", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "확인한 것", exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "아직 모르는 것", exact: true })).toBeVisible();
  await expect(dialog.getByText("최초 징후를 기록했어요")).toHaveCount(0);
  await dialog.getByRole("button", { name: /이전 기록 3개 더 보기/ }).click();
  await expect(dialog.getByText("최초 징후를 기록했어요")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("데모 검토는 판단함만 바꾸며 실제 실행이나 회복을 가장하지 않는다", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:4173"))
      externalRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "판단 연습하기" }).click();
  await dialog.getByRole("button", { name: "검토 완료로 기록" }).click();
  await expect(dialog.getByText("복구는 확인되지 않았어요.", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("실제 운영 작업은 실행되지 않았습니다");
  await dialog.getByRole("button", { name: "목록으로" }).click();
  await expect(
    page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^전체/ }).click();
  await expect(
    page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("상태 화면에서 관측과 미확인 범위를 나눠 읽는다", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "상태", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관측 상태", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "검색 서비스", exact: true })
      .getByText("신호 안정", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("관측 대기", { exact: true })).toBeVisible();
  await expect(page.getByText("회복 여부는 별도 검증이 필요해요.")).toBeVisible();
  await expect(page.getByRole("img", { name: /전달 서비스, 합성 관측/ })).toBeVisible();
  const segmentColor = await page
    .locator(".observation-segment.s")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(segmentColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("status.png"), fullPage: true });
});

test("연결 안내는 공급자와 인증을 구분하고 키를 수집하지 않는다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "연결 안내", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관측 도구", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 모델", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "인증 방식", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "모델 공급자 안내" }).click();
  await page.getByRole("option", { name: "Anthropic" }).click();
  await expect(page.getByText(/Anthropic API 키는 실행 환경/)).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "연결 테스트" })).toHaveCount(0);
});

test("좁은 화면에서도 가로 넘침 없이 읽고 키보드로 진입한다", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.getByRole("heading", { name: "지금 필요한 판단" }).click();
  await page.screenshot({ path: testInfo.outputPath("inbox.png"), fullPage: true });
  await page.getByRole("button", { name: /이벤트 처리 지연이 이어지고 있어요/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.screenshot({ path: testInfo.outputPath("detail.png"), fullPage: true });
});
