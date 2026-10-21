import { useId, useState, type ReactNode, type CSSProperties } from "react";
import { summarizeAvailability, type HistoryDay } from "./uptime";
import "./uptime-timeline.css";

const labels = {
  observed: "관측 확인",
  partial: "일부 미확인",
  error: "오류 신호",
  unknown: "관측 부족",
};
const dateLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export function UptimeTimeline({
  name,
  currentStatus,
  days,
  kind,
  detail,
}: {
  name: string;
  currentStatus: ReactNode;
  days: HistoryDay[];
  kind: "synthetic" | "measured";
  detail?: ReactNode;
}) {
  const [selected, setSelected] = useState(days.length - 1);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const tooltipId = useId();
  const summary = summarizeAvailability(days);
  const visibleIndex = hovered ?? (focused ? selected : null);
  const visibleDay = visibleIndex === null ? null : days[visibleIndex];
  const accessibleDay = days[selected];
  if (!days.length)
    return (
      <section className="uptime-row" aria-label={name}>
        <h2>{name}</h2>
        <p>이력 없음</p>
      </section>
    );
  const lastIsToday = days.at(-1)!.date === new Date().toISOString().slice(0, 10);
  return (
    <section className="uptime-row" aria-label={name} data-kind={kind}>
      <header className="uptime-header">
        <h2>{name}</h2>
        <span className="uptime-current">{currentStatus}</span>
      </header>
      <div
        className="uptime-chart"
        role="group"
        aria-label={`${name}, ${days.length}일 ${kind === "synthetic" ? "예시 " : ""}관측 이력`}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setHovered(
            Math.min(
              days.length - 1,
              Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * days.length)),
            ),
          );
        }}
        onPointerLeave={() => setHovered(null)}
      >
        <div className="uptime-bars" aria-hidden="true">
          {days.map((day, index) => (
            <span
              className={`uptime-bar ${day.state}`}
              data-active={visibleIndex === index || undefined}
              key={day.date}
              style={{ "--window": `${(day.windowMinutes / 1440) * 100}%` } as CSSProperties}
            >
              <span />
            </span>
          ))}
        </div>
        <input
          className="uptime-slider"
          type="range"
          min="0"
          max={days.length - 1}
          value={selected}
          aria-label={`${name} 일별 이력`}
          aria-valuetext={
            accessibleDay
              ? `${dateLabel(accessibleDay.date)} · ${labels[accessibleDay.state]}${accessibleDay.windowMinutes < 1440 ? " · 부분 기간" : ""}`
              : ""
          }
          aria-describedby={visibleDay ? tooltipId : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            setSelected(Number(event.target.value));
            setHovered(null);
          }}
        />
        {visibleDay && (
          <div
            className="uptime-tooltip"
            role="tooltip"
            id={tooltipId}
            style={{
              left: `clamp(104px, ${((visibleIndex! + 0.5) / days.length) * 100}%, calc(100% - 104px))`,
            }}
          >
            <strong>{dateLabel(visibleDay.date)}</strong>
            <span>{labels[visibleDay.state]}</span>
            <span>
              {visibleDay.windowMinutes < 1440
                ? `부분 기간 ${visibleDay.windowMinutes / 60}시간 / 24시간`
                : "기간 24시간"}
            </span>
            {visibleDay.availability && (
              <span>
                확인 {visibleDay.availability.knownMinutes}분 · 가용{" "}
                {visibleDay.availability.availableMinutes}분
              </span>
            )}
            {detail && (
              <div className="uptime-detail">
                <strong>현재 조사</strong>
                {detail}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="uptime-footer">
        <span>{days.length}일 전</span>
        <i />
        <span className="uptime-metric">
          {summary.percentage === null
            ? "가동률 미확인"
            : `${summary.percentage.toFixed(2)}% ${kind === "synthetic" ? "예시 " : ""}가동률`}
        </span>
        <i />
        <span>{lastIsToday ? "오늘" : dateLabel(days.at(-1)!.date)}</span>
      </div>
    </section>
  );
}
