import { useEffect, useState } from "react";
import type { EngineIncident, EngineProjection } from "../server/engine-provider.mjs";
import { Button, Tag } from "./sds/components";
import { SourceSelect } from "./ReceiptApp";

const investigationLabels: Record<string, string> = {
  investigating: "조사 중",
  pending: "조사 중",
  scheduled: "조사 중",
  retrying: "조사 중",
  waiting_for_observation: "관측 대기",
  waiting_observation: "관측 대기",
  budget_paused: "예산 대기",
  budget_wait: "예산 대기",
  outcome_unknown: "결과 불명",
  complete: "조사 완료",
  completed: "조사 완료",
  failed: "조사 실패",
  needs_review: "권한·조건 확인 필요",
  blocked: "권한·조건 확인 필요",
  ineligible: "권한·조건 확인 필요",
};
const evidenceLabels: Record<EngineIncident["evidenceState"], string> = {
  complete: "근거 완비",
  partial: "일부 근거",
  missing: "근거 없음",
  failed: "근거 확인 실패",
  stale: "오래된 근거",
};
const effectLabels: Record<EngineProjection["effects"][number]["state"], string> = {
  executing: "실행 중",
  outcome_unknown: "결과 불명",
  verified: "로컬 probe 확인",
};

function Time({ value }: { value: string | number }) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>시각 범위 확인 필요</span>;
  return (
    <time dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "UTC",
      }).format(date)}{" "}
      UTC
    </time>
  );
}

function readProjection(value: unknown): EngineProjection {
  // 서버의 strict projection만 받는다. 오류 응답·불완전 응답은 화면으로 승격하지 않는다.
  const item = value as EngineProjection | null;
  if (
    !item ||
    item.kind !== "local_engine" ||
    item.scope !== "local_demo" ||
    !["fixture", "openai_responses"].includes(item.investigator) ||
    typeof item.observedAt !== "string" ||
    !Number.isFinite(Date.parse(item.observedAt)) ||
    !Array.isArray(item.incidents) ||
    !Array.isArray(item.pages) ||
    !Array.isArray(item.effects) ||
    item.budgets === null ||
    typeof item.budgets !== "object" ||
    Array.isArray(item.budgets) ||
    !Number.isSafeInteger(item.auditCount)
  )
    throw new Error("engine_unavailable");
  return item;
}

function IncidentRow({ item }: { item: EngineIncident }) {
  return (
    <article className="engine-incident">
      <div className="engine-row">
        <div className="engine-copy">
          <h3>{item.resourceKey}</h3>
          <p>
            {investigationLabels[item.investigation] ?? "조사 상태 확인 필요"} ·{" "}
            {evidenceLabels[item.evidenceState]}
          </p>
        </div>
        <div className="engine-tags">
          <Tag status={item.status === "open" && item.severity === "P0" ? "decision" : undefined}>
            {item.severity}
          </Tag>
          <Tag>{item.status === "resolved" ? "종료" : "진행"}</Tag>
        </div>
      </div>
      <details className="engine-details">
        <summary>근거 · 재시도 · 회복</summary>
        <dl className="receipt-times">
          <div>
            <dt>사건 판본</dt>
            <dd>
              episode {item.episode} · revision {item.revision}
            </dd>
          </div>
          <div>
            <dt>조사 시도</dt>
            <dd>
              전체 {item.attempts}회 · 현재 기간 {item.periodAttempts}회
            </dd>
          </div>
          <div>
            <dt>다음 시각</dt>
            <dd>
              <Time value={item.dueAt} />
            </dd>
          </div>
          <div>
            <dt>지식 참조</dt>
            <dd>{item.knowledgeHits}건</dd>
          </div>
          <div>
            <dt>회복</dt>
            <dd>
              {item.recovery === "verified" ? "표시한 로컬 demo 범위의 독립 probe 확인" : "미확인"}
            </dd>
          </div>
          {item.runbookRef && (
            <div>
              <dt>runbook</dt>
              <dd>
                {item.runbookRef.id} · {item.runbookRef.version}
              </dd>
            </div>
          )}
          {item.failureCode && (
            <div>
              <dt>실패 코드</dt>
              <dd className="mono">{item.failureCode}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
}

function Incidents({ title, items }: { title: string; items: EngineIncident[] }) {
  return (
    <section className="engine-section" aria-label={title}>
      <div className="section-heading">
        <h2 className="section-title">
          {title} <span>{items.length}</span>
        </h2>
        <span className="muted">
          {title === "판단함" ? "진행 중 P0" : "P1 · P2 · 미분류 · 종료"}
        </span>
      </div>
      <div className="engine-list">
        {items.length ? (
          items.map((item) => <IncidentRow key={item.id} item={item} />)
        ) : (
          <p className="engine-empty">해당 사건 없음</p>
        )}
      </div>
    </section>
  );
}

export default function EngineApp() {
  const [snapshot, setSnapshot] = useState<EngineProjection | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [request, setRequest] = useState(0);
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
  }, [scheme]);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null);
    setState("loading");
    fetch("/api/engine", {
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return readProjection(await response.json());
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setSnapshot(value);
          setState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [request]);
  const isDecision = (item: EngineIncident) => item.status === "open" && item.severity === "P0";
  return (
    <div className="app-shell engine-app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <a className="brand" href="#main">
          oh-my-SRE
        </a>
        <span className="demo-label">LOCAL</span>
        <div className="header-actions">
          <Button
            variant="ghost"
            aria-label={scheme === "light" ? "어두운 테마" : "밝은 테마"}
            onClick={() => setScheme(scheme === "light" ? "dark" : "light")}
          >
            ◐
          </Button>
        </div>
      </header>
      <nav className="app-nav receipt-nav" aria-label="자료 선택">
        <span>읽기 전용 엔진</span>
        <SourceSelect mode="engine" />
      </nav>
      <main id="main" className="main-content" tabIndex={-1}>
        <header className="page-heading">
          <div>
            <h1>로컬 엔진</h1>
            <p>자체 로컬 worker</p>
          </div>
          <Button variant="ghost-muted" onClick={() => setRequest(request + 1)}>
            다시 읽기
          </Button>
        </header>
        <div className="receipt-scope">
          <Tag>로컬 demo 범위</Tag>
          <p>근거 완비 ≠ 서비스 정상</p>
        </div>
        {state === "loading" && (
          <p className="notice" role="status">
            엔진 snapshot 읽는 중
          </p>
        )}
        {state === "error" && (
          <div className="notice" role="alert">
            <strong>엔진 snapshot을 읽을 수 없음</strong>
            <p>로컬 연결 설정 또는 projection 파일 상태 확인 필요.</p>
          </div>
        )}
        {snapshot && (
          <>
            <div className="engine-context">
              <Tag>
                {snapshot.investigator === "fixture"
                  ? "합성 investigator"
                  : "OpenAI Responses investigator"}
              </Tag>
              <p>
                스냅샷 생성 <Time value={snapshot.observedAt} /> · 자동 갱신 없음
              </p>
              <p>
                입력 fixture 여부는 이 projection에서 미제공 · 이 화면의 실모델 live 호출 0회 · 운영
                연결 없음
              </p>
            </div>
            <Incidents title="판단함" items={snapshot.incidents.filter(isDecision)} />
            <Incidents
              title="사건 상태"
              items={snapshot.incidents.filter((item) => !isDecision(item))}
            />
            <section className="engine-section" aria-label="호출 예산">
              <h2 className="section-title">호출 예산</h2>
              <p className="engine-note">조사 호출 횟수 · 기간별 예약 / 사용</p>
              <div className="engine-list">
                {Object.entries(snapshot.budgets).map(([period, counts]) => (
                  <div className="engine-row" key={period}>
                    <span className="engine-copy">
                      <Time value={Number(period)} />
                    </span>
                    <span className="engine-tags">
                      예약 {counts.reserved}회 · 사용 {counts.spent}회
                    </span>
                  </div>
                ))}
                {Object.keys(snapshot.budgets).length === 0 && (
                  <p className="engine-empty">예산 기록 없음</p>
                )}
              </div>
            </section>
            <section className="engine-section" aria-label="로컬 outbox">
              <h2 className="section-title">
                로컬 outbox <span>{snapshot.pages.length}</span>
              </h2>
              <p className="engine-note">로컬 페이지 의도·ACK 기록 · 외부 알림 전송 없음</p>
              <div className="engine-list">
                {snapshot.pages.map((page) => (
                  <div className="engine-row" key={page.key}>
                    <div className="engine-copy">
                      <h3>사건 {page.incidentId.slice(0, 8)}</h3>
                      <p>
                        episode {page.episode} · revision {page.revision}
                        {page.recoveryUpdate ? " · 회복 갱신" : ""}
                      </p>
                    </div>
                    <Tag>{page.state === "pending" ? "ACK 대기" : "ACK 기록"}</Tag>
                  </div>
                ))}
                {!snapshot.pages.length && <p className="engine-empty">페이지 의도 없음</p>}
              </div>
            </section>
            <section className="engine-section" aria-label="실행 상태">
              <h2 className="section-title">
                실행 상태 <span>{snapshot.effects.length}</span>
              </h2>
              <p className="engine-note">표시한 로컬 demo 범위 · 회복과 실행 확인은 별도</p>
              <div className="engine-list">
                {snapshot.effects.map((effect) => (
                  <div className="engine-row" key={effect.id}>
                    <div className="engine-copy">
                      <h3>{effect.resourceKey}</h3>
                      <p>
                        {effect.runbookRef.id} · {effect.runbookRef.version} · revision{" "}
                        {effect.revision}
                      </p>
                    </div>
                    <Tag>{effectLabels[effect.state]}</Tag>
                  </div>
                ))}
                {!snapshot.effects.length && <p className="engine-empty">실행 기록 없음</p>}
              </div>
            </section>
            <p className="engine-note engine-audit">
              감사 기록 {snapshot.auditCount}건 · 원문·자격증명 미제공
            </p>
          </>
        )}
      </main>
    </div>
  );
}
