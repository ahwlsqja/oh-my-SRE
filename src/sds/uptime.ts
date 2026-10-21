export type DayState = "observed" | "partial" | "error" | "unknown";
export interface HistoryDay {
  date: string;
  state: DayState;
  windowMinutes: number;
  availability?: { knownMinutes: number; availableMinutes: number };
}

export function summarizeAvailability(days: HistoryDay[]): {
  percentage: number | null;
  coverage: number;
} {
  let known = 0;
  let available = 0;
  let expected = 0;
  let previous: number | null = null;
  for (const day of days) {
    const timestamp = Date.parse(day.date + "T00:00:00Z");
    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== day.date ||
      (previous !== null && timestamp - previous !== 86400000)
    )
      throw new RangeError(
        "날짜는 연속된 일별 구간이어야 합니다. 누락일은 unknown으로 명시합니다.",
      );
    previous = timestamp;
    const { windowMinutes: window, availability } = day;
    if (!Number.isFinite(window) || window < 0 || window > 1440)
      throw new RangeError("일별 기간 범위 오류");
    expected += window;
    if (!availability) continue;
    const { knownMinutes: measured, availableMinutes: up } = availability;
    if (
      !Number.isFinite(measured) ||
      !Number.isFinite(up) ||
      up < 0 ||
      measured < 0 ||
      up > measured ||
      measured > window ||
      (day.state === "unknown" && measured > 0)
    )
      throw new RangeError("가용성 근거 범위 오류");
    known += measured;
    available += up;
  }
  const complete =
    days.length > 0 &&
    days.every((day) => day.windowMinutes === 1440 && day.availability?.knownMinutes === 1440);
  return {
    percentage: complete && known > 0 ? Math.round((available / known) * 10000) / 100 : null,
    coverage: expected ? known / expected : 0,
  };
}
