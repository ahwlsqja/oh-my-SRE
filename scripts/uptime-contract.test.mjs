import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeAvailability } from "../src/sds/uptime.ts";

const day = (date, knownMinutes, availableMinutes, windowMinutes = 1440) => ({
  date,
  state: "observed",
  windowMinutes,
  availability: { knownMinutes, availableMinutes },
});
test("전체 측정 근거가 있을 때만 가동률을 표시하고 미확인·부분기간은 승격하지 않는다", () => {
  assert.equal(summarizeAvailability([day("2026-10-20", 1440, 1425.6)]).percentage, 99);
  const incomplete = summarizeAvailability([
    day("2026-10-20", 1440, 1440),
    { date: "2026-10-21", state: "unknown", windowMinutes: 1440 },
  ]);
  assert.equal(incomplete.percentage, null);
  assert.equal(incomplete.coverage, 0.5);
  assert.equal(summarizeAvailability([day("2026-10-21", 720, 720, 720)]).percentage, null);
  assert.equal(
    summarizeAvailability([{ date: "2026-10-21", state: "observed", windowMinutes: 1440 }])
      .percentage,
    null,
  );
});
test("가용 시간이 확인 시간을 넘는 입력과 unknown의 가용성 주장을 거부한다", () => {
  assert.throws(() => summarizeAvailability([day("2026-10-21", 60, 61)]), RangeError);
  assert.throws(
    () => summarizeAvailability([{ ...day("2026-10-21", 60, 60), state: "unknown" }]),
    RangeError,
  );
});
