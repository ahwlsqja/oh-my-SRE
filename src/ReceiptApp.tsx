import { useEffect, useState } from "react";
import { Button, Select, Tag } from "./sds/components";
import { projectSnapshot, type Snapshot, type Receipt } from "./providers/receipt";

export function SourceSelect({ mode }: { mode: "demo" | "receipt" | "engine" }) {
  return (
    <Select
      aria-label="자료 출처"
      value={mode}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        if (value === "receipt" || value === "engine") url.searchParams.set("mode", value);
        else url.searchParams.delete("mode");
        window.location.assign(url);
      }}
      options={[
        { value: "demo", label: "합성 예시" },
        { value: "receipt", label: "근거 스냅샷" },
        { value: "engine", label: "로컬 엔진" },
      ]}
    />
  );
}
const sourceLabels: Record<Receipt["sourceKind"], string> = {
  deployment_readback: "배포 readback",
  collector_readback: "수집 readback",
  clickhouse_scoped_aggregate: "ClickHouse 범위 집계",
  product_overview_http: "제품 Overview HTTP",
  sre_operations_overview_http: "SRE 운영 Overview HTTP",
};
const claimLabels: Record<Receipt["claim"], string> = {
  deployment_binding: "배포 판본·자산",
  collector_acceptance: "수집 실행 결과",
  raw_overview_cohort: "Raw → Overview 집계 범위",
  raw_load_boundary_membership: "Raw → 적재원장 연결",
  flink_fact_cohort: "Flink · Fact 병렬 범위",
  fact_candidate_membership: "Raw 세션 → Fact 후보 대응",
  product_overview_response: "제품 응답",
  sre_operations_projection: "SRE 상태 투영",
};
const limitationLabels: Record<Receipt["limitations"][number], string> = {
  service_health_unverified: "서비스 정상 미확인",
  recovery_unverified: "회복 미확인",
  cohort_incomplete: "동일 cohort 전체 경로 미확인",
  physical_row_semantics: "물리 행 기준 · 병합 전 중복 가능",
  flink_unverified: "Flink 경로 미확인",
  product_response_unverified: "실제 제품 응답 미확인",
  authentication_required: "제품 세션 인증 필요",
  history_unavailable: "기간별 이력 미제공",
  unique_observations_unverified: "관측 고유 건수 미확인",
  scope_only: "표시한 범위에 한정",
  source_delivery_unverified: "수신 → Kafka → Raw의 동일 범위 결속 미확인",
  current_winner_unverified: "현재 winner · 완전성 미확인",
};
const statusLabels = {
  verified: "단계 확인",
  partial: "일부 확인",
  unknown: "미확인",
  failed: "확인 실패",
  stale: "오래된 근거",
};
const countLabels = {
  checksPassed: "통과 검사",
  accepted: "수신",
  ok: "조회 성공",
  empty: "빈 결과",
  partial: "부분 결과",
  unknown: "미확인 결과",
  rows: "물리 행",
  events: "이벤트",
  sessions: "세션",
  pageviews: "페이지뷰",
  fragments: "Fragment",
  starts: "시작 후보 행",
  httpStatus: "HTTP",
  rawBoundaries: "Raw 경계",
  loadedBoundaries: "적재 경계",
};
function Time({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))}{" "}
      UTC
    </time>
  );
}

export default function ReceiptApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(Date.now());
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const [request, setRequest] = useState(0);
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
  }, [scheme]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setSnapshot(null);
    fetch("/api/receipts", {
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: unknown = await response.json();
        projectSnapshot(value);
        return value as Snapshot;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setSnapshot(value);
          setNow(Date.now());
          setState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [request]);
  const view = snapshot ? projectSnapshot(snapshot, now) : null;
  return (
    <div className="app-shell receipt-app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <a className="brand" href="#main">
          oh-my-SRE
        </a>
        <span className="demo-label">SNAPSHOT</span>
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
        <span>읽기 전용 근거</span>
        <SourceSelect mode="receipt" />
      </nav>
      <main id="main" className="main-content" tabIndex={-1}>
        <header className="page-heading">
          <div>
            <h1>근거 스냅샷</h1>
            <p>원천 시각과 확인 범위</p>
          </div>
          <Button variant="ghost-muted" onClick={() => setRequest(request + 1)}>
            다시 읽기
          </Button>
        </header>
        <div className="receipt-scope">
          <Tag>전체 경로 일부 확인</Tag>
          <p>단계별 근거만 제공. 전체 서비스 정상·무유실·회복 미확인.</p>
        </div>
        {state === "loading" && (
          <p className="notice" role="status">
            근거 읽는 중
          </p>
        )}
        {state === "error" && (
          <div className="notice" role="alert">
            <strong>근거를 읽을 수 없음</strong>
            <p>연결 설정 또는 파일 상태 확인 필요.</p>
          </div>
        )}
        {view && (
          <>
            <p className="receipt-captured">
              스냅샷 수집 <Time value={view.capturedAt} /> · 재조회로 근거 시각 연장 없음
            </p>
            <div className="receipt-list">
              {view.receipts.map((receipt, index) => (
                <section
                  className="receipt-row"
                  key={`${receipt.claim}-${index}`}
                  aria-label={claimLabels[receipt.claim]}
                >
                  <div className="receipt-heading">
                    <div>
                      <span className="receipt-source">{sourceLabels[receipt.sourceKind]}</span>
                      <h2>{claimLabels[receipt.claim]}</h2>
                    </div>
                    <Tag>{statusLabels[receipt.status]}</Tag>
                  </div>
                  <dl className="receipt-times">
                    <div>
                      <dt>원천 관측</dt>
                      <dd>
                        <Time value={receipt.observedAt} />
                      </dd>
                    </div>
                    {receipt.window && (
                      <div>
                        <dt>집계 창</dt>
                        <dd>
                          <Time value={receipt.window.start} /> →{" "}
                          <Time value={receipt.window.end} />{" "}
                          <span className="muted">시작 포함 · 끝 제외</span>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>근거 만료</dt>
                      <dd>
                        <Time value={receipt.expiresAt} />{" "}
                        <span className="mono">TTL {receipt.ttlSeconds}초</span>
                      </dd>
                    </div>
                  </dl>
                  <div className="receipt-counts">
                    {Object.entries(receipt.counters).map(([key, value]) => (
                      <span key={key}>
                        {countLabels[key as keyof typeof countLabels]}{" "}
                        <strong className="mono">{value}</strong>
                      </span>
                    ))}
                  </div>
                  <p className="receipt-limitations">
                    {receipt.limitations.map((limit) => limitationLabels[limit]).join(" · ")}
                  </p>
                  <p className="receipt-digest mono">
                    범위 {receipt.scopeDigest.slice(0, 12)} · 근거{" "}
                    {receipt.evidenceDigest.slice(0, 12)} ·{" "}
                    {receipt.coverage === "scoped" ? "지정 범위" : "불완전 범위"}
                  </p>
                </section>
              ))}
            </div>
          </>
        )}
        <section className="receipt-unavailable" aria-label="제공 범위">
          <h2>미제공 범위</h2>
          <p>사건 · 비용 · 모델 실행 미제공</p>
          <p>기간별 이력 미제공</p>
        </section>
      </main>
    </div>
  );
}
