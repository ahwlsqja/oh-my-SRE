import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  UptimeTimeline,
  Select,
  Tabs,
  Tag,
  statusSemantics,
} from "./sds/components";
import { demoCases, serviceObservations, type SreCase } from "./demo";
import ReceiptApp, { SourceSelect } from "./ReceiptApp";

type Page = "inbox" | "status" | "connections";
type Filter = "decision" | "investigation" | "all";
type IconName = "inbox" | "status" | "connect" | "arrow" | "shield" | "clock" | "theme";
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    inbox: "M4 4h16v16H4z M4 14h5l2 3h2l2-3h5",
    status: "M3 12h4l3-7 4 14 3-7h4",
    connect:
      "M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
    clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    theme: "M20 15A8 8 0 0 1 9 4a8.5 8.5 0 1 0 11 11z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function CaseBadge({ item }: { item: SreCase }) {
  if (item.decision === "reviewed") return <Tag status="reviewed" />;
  if (item.decision === "held") return <Tag status="held" />;
  if (item.investigation === "waiting_for_observation") return <Tag status="observation_gap" />;
  if (item.investigation === "budget_paused") return <Tag status="budget_paused" />;
  return (
    <Tag status="decision">
      {item.priority} · {statusSemantics.decision.label}
    </Tag>
  );
}

function CaseDetail({
  item,
  onRecord,
  notice,
}: {
  item: SreCase;
  onRecord: (decision: "held" | "reviewed") => void;
  notice: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const summaries = [
    ["상황", item.summary.situation],
    ["확인", item.summary.confirmed],
    ["미확인 범위", item.summary.unknown],
    ["다음 조사", item.summary.next],
    ["필요한 결정", item.summary.decision],
  ];
  return (
    <>
      <div className="detail-top">
        <Dialog.Close>
          <Button variant="ghost" aria-label="목록으로">
            ← 목록으로
          </Button>
        </Dialog.Close>
        <span className="mono muted">{item.id}</span>
      </div>
      <div className="detail-scroll">
        <header className="detail-heading">
          <div className="detail-meta">
            <CaseBadge item={item} />
            <span>{item.service}</span>
          </div>
          <Dialog.Title className="case-title">{item.title}</Dialog.Title>
          <Dialog.Description>
            최근 관측 {item.updated} · 근거 {item.evidence.length}건
          </Dialog.Description>
        </header>
        <section className="summary-list" aria-label="다섯 항목 사건 요약">
          {summaries.map(([title, content]) => (
            <div className="summary-item" key={title}>
              <h3>{title}</h3>
              <p>{content}</p>
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3 className="section-title">
            근거 <span>{item.evidence.length}</span>
          </h3>
          <div className="evidence-list">
            {item.evidence.map((evidence) => (
              <div className="evidence" key={evidence.title}>
                <Icon name="shield" />
                <div>
                  <strong>{evidence.title}</strong>
                  <p>{evidence.detail}</p>
                </div>
                <time>{evidence.time}</time>
              </div>
            ))}
          </div>
        </section>
        <details className="model-record">
          <summary>모델 실행 기록</summary>
          <div className="model-record-body">
            <p>
              <strong>조사 모델</strong>
              <span>{item.models.investigation}</span>
            </p>
            <p>
              <strong>독립 검토</strong>
              <span>{item.models.review}</span>
            </p>
          </div>
        </details>
        <section className="detail-section">
          <div className="section-heading">
            <h3 className="section-title">최근 기록</h3>
            <span className="muted">최신순</span>
          </div>
          <ol className="timeline">
            {item.history.slice(0, expanded ? undefined : 3).map((event) => (
              <li key={event.time}>
                <time>{event.time}</time>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {item.history.length > 3 && (
            <Button
              variant="ghost-muted"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "이전 기록 접기" : `이전 기록 ${item.history.length - 3}개 더 보기`}
            </Button>
          )}
        </section>
        <p className="recovery-note">
          <Icon name="shield" />
          회복 검증: 미확인
        </p>
        {recording && (
          <section className="decision-form" aria-label="판단 기록">
            <h3>판단 기록</h3>
            <p>이 화면의 기록만 변경됩니다. 외부 실행 없음.</p>
            <div className="button-row">
              <Button
                onClick={() => {
                  onRecord("held");
                  setRecording(false);
                }}
              >
                보류 기록
              </Button>
              <Button
                variant="contrast"
                onClick={() => {
                  onRecord("reviewed");
                  setRecording(false);
                }}
              >
                검토 완료 기록
              </Button>
            </div>
          </section>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </div>
      <footer className="detail-footer">
        <span>실제 실행 · 회복 검증 별도</span>
        {item.decision !== null && item.decision !== "reviewed" && !recording ? (
          <Button variant="contrast" size="large" onClick={() => setRecording(true)}>
            판단 기록 <Icon name="arrow" />
          </Button>
        ) : (
          <Tag status={item.decision === "reviewed" ? "reviewed" : "observation_gap"} />
        )}
      </footer>
    </>
  );
}

function StatusPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>관측 상태</h1>
          <p>서비스별 관측과 미확인 범위</p>
        </div>
        <span className="mono muted">기준 2026.10.21</span>
      </header>
      <div className="service-list">
        {serviceObservations.map((service) => (
          <UptimeTimeline
            key={service.name}
            name={service.name}
            kind="synthetic"
            days={service.days}
            currentStatus={
              <>
                <Tag status={service.state} />
                <span className="mono">{service.last}</span>
              </>
            }
            detail={
              <>
                <span>{service.action}</span>
                <span>{service.unknown}</span>
              </>
            }
          />
        ))}
      </div>
      <div className="history-legend">
        <span>
          <i className="s" />
          관측 확인
        </span>
        <span>
          <i className="p" />
          일부 미확인
        </span>
        <span>
          <i className="e" />
          오류 신호
        </span>
        <span>
          <i className="u" />
          관측 부족
        </span>
      </div>
      <p className="status-context">관측 수신과 서비스 정상·무유실·회복은 별도 판정.</p>
    </>
  );
}

function ConnectionsPage() {
  const [provider, setProvider] = useState("openai");
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>연결</h1>
          <p>관측 · 모델 · 인증</p>
        </div>
        <Tag>미연결</Tag>
      </header>
      <div className="connection-sections">
        <section>
          <span className="connection-number">01</span>
          <div>
            <h2>관측 도구</h2>
            <p>로그·지표·오류 추적의 제한된 근거 수집.</p>
            <div className="connection-tags">
              <Tag>지표</Tag>
              <Tag>로그</Tag>
              <Tag>오류 추적</Tag>
            </div>
            <p className="muted">관측 어댑터 미구현.</p>
          </div>
        </section>
        <section>
          <span className="connection-number">02</span>
          <div>
            <h2>AI 모델</h2>
            <p>조사 모델과 독립 검토 모델을 별도 선택.</p>
            <Select
              aria-label="모델 공급자 안내"
              value={provider}
              onValueChange={setProvider}
              options={[
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "other", label: "기타 호환 공급자" },
              ]}
            />
            <p className="provider-guidance">
              {provider === "anthropic"
                ? "Anthropic API 키는 실행 환경에서 관리."
                : provider === "openai"
                  ? "OpenAI API 키는 실행 환경에서 관리."
                  : "호환 API·모델·비용 계약 확인 필요."}{" "}
              모델 호출 미연결.
            </p>
          </div>
        </section>
        <section>
          <span className="connection-number">03</span>
          <div>
            <h2>인증 방식</h2>
            <p>API 키와 구독 기반 로그인은 별도 계약.</p>
            <p className="muted">
              구독 로그인은 공급자의 공식 실행 경로·이용 조건 확인 필요. 비밀은 실행 환경에서
              관리하며 화면은 연결 상태만 표시.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function DemoApp() {
  const [page, setPage] = useState<Page>("inbox");
  const [filter, setFilter] = useState<Filter>("decision");
  const [cases, setCases] = useState(() => structuredClone(demoCases));
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
  }, [scheme]);
  const needsDecision = cases.filter(
    (item) => item.decision !== null && item.decision !== "reviewed",
  );
  const investigations = cases.filter((item) => item.decision === null);
  const visible = [
    ...(filter === "decision"
      ? needsDecision
      : filter === "investigation"
        ? investigations
        : cases),
  ].sort((left, right) => right.updated.localeCompare(left.updated));
  const selectedCase = cases.find((item) => item.id === selected);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <a
          href="#main"
          className="brand"
          onClick={() => setPage("inbox")}
          aria-label="oh-my-SRE 판단함"
        >
          <span className="brand-symbol">
            <Icon name="status" size={18} />
          </span>
          oh-my-SRE
        </a>
        <span className="demo-label" title="합성 데이터 · 실제 운영 연결 없음">
          DEMO
        </span>
        <div className="header-actions">
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="ghost-muted">
                <span className="connection-dot" />
                에이전트 미연결
              </Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <div data-slot="dialog-header">
                <div data-slot="dialog-title-group">
                  <Dialog.Title data-slot="dialog-title">에이전트</Dialog.Title>
                  <Dialog.Description data-slot="dialog-description">
                    실행 환경 미연결
                  </Dialog.Description>
                </div>
              </div>
              <div className="agent-description">
                <p>읽기 전용 조사 → 근거·제안 → 사람 판단.</p>
                <p>실제 조치와 회복 검증은 별도 수동 절차.</p>
              </div>
              <div data-slot="dialog-footer">
                <Dialog.Close>
                  <Button>닫기</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Root>
          <Button
            variant="ghost"
            aria-label={scheme === "light" ? "어두운 테마" : "밝은 테마"}
            title={scheme === "light" ? "어두운 테마" : "밝은 테마"}
            onClick={() => setScheme(scheme === "light" ? "dark" : "light")}
          >
            <Icon name="theme" />
          </Button>
        </div>
      </header>
      <nav className="app-nav" aria-label="주요 메뉴">
        <Tabs
          items={[
            { value: "inbox", label: "판단함", count: needsDecision.length },
            { value: "status", label: "상태" },
            { value: "connections", label: "연결 안내" },
          ]}
          value={page}
          onChange={setPage}
          label="화면"
        />
      </nav>
      <main id="main" className="main-content" tabIndex={-1}>
        {page === "inbox" && (
          <>
            <header className="page-heading">
              <div>
                <h1 ref={headingRef} tabIndex={-1}>
                  판단 대기
                </h1>
                <p>사람의 결정이 필요한 사건</p>
              </div>
              <span className="mono muted">{needsDecision.length}건</span>
            </header>
            <div className="overview-line">
              <span>
                <Icon name="shield" />
                읽기 전용
              </span>
              <span>
                조사 예산 <strong className="mono">$0.18 / $1.00</strong>
              </span>
              <span className="mono">관측 10:12</span>
            </div>
            <div className="inbox-toolbar">
              <Tabs
                compact
                items={[
                  { value: "decision", label: "판단 필요", count: needsDecision.length },
                  { value: "investigation", label: "조사 상태", count: investigations.length },
                  { value: "all", label: "전체", count: cases.length },
                ]}
                value={filter}
                onChange={setFilter}
                label="사건 필터"
              />
              <span className="muted">최신순</span>
            </div>
            <div className="case-list">
              {visible.length === 0 ? (
                <div className="empty-state">
                  <Icon name="inbox" size={24} />
                  <h2>판단 대기 없음</h2>
                  <p>전체 목록에서 이전 기록 확인 가능.</p>
                  <Button onClick={() => setFilter("all")}>전체 보기</Button>
                </div>
              ) : (
                visible.map((item) => (
                  <button
                    className="case-row"
                    key={item.id}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setNotice("");
                      setSelected(item.id);
                    }}
                  >
                    <span className="case-id">{item.id}</span>
                    <span className="case-copy">
                      <span className="case-title-line">
                        <strong>{item.title}</strong>
                        <CaseBadge item={item} />
                      </span>
                      <span className="case-preview">{item.preview}</span>
                      <span className="case-service">{item.service}</span>
                    </span>
                    <span className="case-trailing">
                      <time>{item.updated}</time>
                      <Icon name="arrow" />
                    </span>
                  </button>
                ))
              )}
            </div>
            {notice && !selected && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
          </>
        )}
        {page === "status" && <StatusPage />}
        {page === "connections" && <ConnectionsPage />}
        <footer className="page-footer">
          <SourceSelect mode="demo" />
          <Button
            variant="ghost-muted"
            size="small"
            onClick={() => {
              setCases(structuredClone(demoCases));
              setNotice("예시 기록 초기화 완료.");
              setFilter("decision");
            }}
          >
            예시 초기화
          </Button>
        </footer>
      </main>
      <Dialog.Root
        open={!!selectedCase}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Content
          layout="case"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (triggerRef.current?.isConnected) triggerRef.current.focus();
            else headingRef.current?.focus();
          }}
        >
          {selectedCase && (
            <CaseDetail
              key={selectedCase.id}
              item={selectedCase}
              notice={notice}
              onRecord={(decision) => {
                setCases((current) =>
                  current.map((item) =>
                    item.id === selectedCase.id ? { ...item, decision } : item,
                  ),
                );
                setNotice("기록 변경 완료. 외부 실행 없음.");
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

export default function App() {
  return new URLSearchParams(window.location.search).get("mode") === "receipt" ? (
    <ReceiptApp />
  ) : (
    <DemoApp />
  );
}
