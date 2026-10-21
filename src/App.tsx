import { useRef, useState } from "react";
import { Badge, Button, Dialog, Heading, Select, Text } from "@radix-ui/themes";
import { demoCases, serviceObservations, type SreCase } from "./demo";

type Page = "inbox" | "status" | "connections";
type Filter = "decision" | "investigation" | "all";
type IconName = "inbox" | "status" | "connect" | "arrow" | "shield" | "spark" | "clock" | "chevron";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    inbox: "M4 4h16v16H4z M4 14h5l2 3h2l2-3h5",
    status: "M3 12h4l3-7 4 14 3-7h4",
    connect:
      "M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
    spark: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    chevron: "M9 5l7 7-7 7",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function CaseBadge({ item }: { item: SreCase }) {
  if (item.decision === "reviewed")
    return (
      <Badge color="gray" variant="soft">
        데모 검토 완료
      </Badge>
    );
  if (item.decision === "held")
    return (
      <Badge color="gray" variant="soft">
        판단 보류
      </Badge>
    );
  if (item.investigation === "waiting_for_observation")
    return (
      <Badge color="gray" variant="soft">
        관측 부족
      </Badge>
    );
  if (item.investigation === "budget_paused")
    return (
      <Badge color="gray" variant="soft">
        예산 대기
      </Badge>
    );
  return (
    <Badge color={item.priority === "P1" ? "amber" : "gray"} variant="soft">
      {item.priority} · 판단 필요
    </Badge>
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
    ["확인한 것", item.summary.confirmed],
    ["아직 모르는 것", item.summary.unknown],
    ["다음 행동", item.summary.next],
    ["필요한 결정", item.summary.decision],
  ];
  return (
    <>
      <div className="detail-top">
        <Dialog.Close>
          <Button variant="ghost" color="gray" aria-label="목록으로">
            ← 목록으로
          </Button>
        </Dialog.Close>
        <Text size="1" color="gray">
          합성 사례 · {item.id}
        </Text>
      </div>
      <div className="detail-scroll">
        <div className="detail-heading">
          <CaseBadge item={item} />
          <Dialog.Title className="case-title" size="6">
            {item.title}
          </Dialog.Title>
          <Dialog.Description size="2" color="gray">
            {item.service} · 마지막 합성 관측 {item.updated}
          </Dialog.Description>
        </div>
        <section className="summary-list" aria-label="다섯 문장으로 읽는 사건">
          {summaries.map(([title, content], index) => (
            <div className="summary-item" key={title}>
              <span className="summary-number" aria-hidden="true">
                0{index + 1}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{content}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3 className="section-title">
            판단의 근거 <span>{item.evidence.length}</span>
          </h3>
          <div className="evidence-list">
            {item.evidence.map((evidence) => (
              <div className="evidence" key={evidence.title}>
                <div className="evidence-icon">
                  <Icon name="shield" size={16} />
                </div>
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
          <summary>
            모델 실행 기록 <span>합성 예시</span>
          </summary>
          <div className="model-record-body">
            <p>
              <strong>조사 모델</strong>
              <span>{item.models.investigation}</span>
            </p>
            <p>
              <strong>독립 검토 모델</strong>
              <span>{item.models.review}</span>
            </p>
            <small>
              모델과 실제 계정은 연결되지 않았습니다. 시각·결과·금액은 모두 설명용입니다.
            </small>
          </div>
        </details>
        <section className="detail-section">
          <div className="section-heading">
            <h3 className="section-title">최근 기록</h3>
            <span>최신순 · 합성 타임라인</span>
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
              variant="ghost"
              color="gray"
              size="2"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "이전 기록 접기" : `이전 기록 ${item.history.length - 3}개 더 보기`}
            </Button>
          )}
        </section>
        <div className="recovery-note">
          <Icon name="shield" size={17} />
          <div>
            <strong>복구는 확인되지 않았어요.</strong>
            <p>판단 기록, 실제 수동 실행, 회복 검증은 각각 다른 단계예요.</p>
          </div>
        </div>
        {recording && (
          <section className="decision-form" aria-label="데모 판단 기록">
            <h3>판단 내용을 데모에 기록</h3>
            <p>
              이 화면의 예시 상태만 바뀝니다. 승인 권한을 발급하거나 외부 작업을 실행하지 않아요.
            </p>
            <div className="button-row">
              <Button
                variant="soft"
                color="gray"
                onClick={() => {
                  onRecord("held");
                  setRecording(false);
                }}
              >
                보류로 기록
              </Button>
              <Button
                onClick={() => {
                  onRecord("reviewed");
                  setRecording(false);
                }}
              >
                검토 완료로 기록
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
      <div className="detail-footer">
        <span>데모 판단 · 외부 실행 없음</span>
        {item.decision !== null && item.decision !== "reviewed" && !recording ? (
          <Button onClick={() => setRecording(true)}>
            판단 연습하기 <Icon name="arrow" size={16} />
          </Button>
        ) : (
          <Badge color="gray">
            {item.decision === "reviewed" ? "데모 검토 완료" : "읽기 전용"}
          </Badge>
        )}
      </div>
    </>
  );
}

function StatusPage() {
  const stateLabels: Record<string, string> = { s: "신호 안정", p: "일부 미확인", u: "관측 부족" };
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">근거의 도착 상태</p>
        <Heading size="7">관측 상태</Heading>
        <p>도착한 근거와 아직 모르는 범위를 나눠 봅니다.</p>
      </div>
      <div className="status-caption">
        <span className="status-dot" />
        마지막 합성 관측 10:12<span>실제 서비스에는 연결되지 않았습니다</span>
      </div>
      <div className="service-list">
        {serviceObservations.map((service) => (
          <section className="service-row" key={service.name} aria-label={service.name}>
            <div className="service-top">
              <div className="service-name">
                <h2>{service.name}</h2>
                <span>{service.scope}</span>
              </div>
              <div className="service-state">
                <Badge color={service.tone} variant="soft">
                  {service.state}
                </Badge>
                <p>마지막 확인 {service.last}</p>
              </div>
            </div>
            <div
              className="observation-bar"
              role="img"
              aria-label={`${service.name}, 합성 관측 ${service.history.length}회. 최근 상태: ${service.state}. 정상이나 회복의 증명이 아닙니다.`}
            >
              {Array.from(service.history).map((state, index) => (
                <span
                  key={index}
                  className={`observation-segment ${state}`}
                  title={`합성 관측 ${index + 1}: ${stateLabels[state]}`}
                />
              ))}
            </div>
            <div className="observation-range">
              <span>이전 관측</span>
              <span>합성 이력 · {service.history.length}회</span>
              <span>최근</span>
            </div>
            <div className="service-action">
              <strong>{service.action}</strong>
              <p>{service.unknown}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="status-legend">
        <span>
          <i className="s" />
          신호 안정
        </span>
        <span>
          <i className="p" />
          일부 미확인
        </span>
        <span>
          <i className="u" />
          관측 부족
        </span>
      </div>
      <div className="quiet-note">
        <Icon name="shield" />
        <p>
          관측 도착만으로 서비스 정상이나 무유실을 확정하지 않아요.
          <br />새 근거가 오면 이전 기록과 대조하고, 확인되지 않은 범위는 그대로 남깁니다.
        </p>
      </div>
    </>
  );
}

function ConnectionsPage() {
  const [provider, setProvider] = useState("openai");
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">도구는 바뀌어도, 판단은 분명하게</p>
        <Heading size="7">연결 안내</Heading>
        <p>관측과 모델, 인증은 각각 선택할 수 있도록 설계합니다.</p>
      </div>
      <div className="connection-notice">
        <Badge color="gray">연결 전</Badge>
        <span>이 데모는 키를 받거나 저장하지 않습니다. 선택하면 안내만 바뀝니다.</span>
      </div>
      <div className="connection-sections">
        <section>
          <span className="connection-number">01</span>
          <div>
            <h2>관측 도구</h2>
            <p>이미 쓰는 로그·지표·오류 도구에서 범위가 제한된 근거를 읽습니다.</p>
            <div className="connection-tags">
              <span>지표</span>
              <span>로그</span>
              <span>오류 추적</span>
            </div>
            <p className="muted">실제 관측 어댑터는 아직 제공되지 않습니다.</p>
          </div>
        </section>
        <section>
          <span className="connection-number">02</span>
          <div>
            <h2>AI 모델</h2>
            <p>조사 모델과 독립 검토 모델은 관측 도구와 별도로 선택합니다.</p>
            <Select.Root value={provider} onValueChange={setProvider}>
              <Select.Trigger aria-label="모델 공급자 안내" placeholder="공급자 선택" />
              <Select.Content>
                <Select.Item value="openai">OpenAI</Select.Item>
                <Select.Item value="anthropic">Anthropic</Select.Item>
                <Select.Item value="other">기타 호환 공급자</Select.Item>
              </Select.Content>
            </Select.Root>
            <p className="provider-guidance">
              {provider === "anthropic"
                ? "Anthropic API 키는 실행 환경에서 관리해야 합니다."
                : provider === "openai"
                  ? "OpenAI API 키는 실행 환경에서 관리해야 합니다."
                  : "호환 API·모델·비용 보고 계약을 먼저 확인해야 합니다."}{" "}
              실제 모델 호출 기능은 포함되지 않습니다.
            </p>
          </div>
        </section>
        <section>
          <span className="connection-number">03</span>
          <div>
            <h2>인증 방식</h2>
            <p>API 키와 구독 기반 실행 환경의 로그인은 서로 다른 방식입니다.</p>
            <p className="muted">
              구독 로그인은 공급자가 공식 지원하는 실행 경로와 이용 조건을 확인한 뒤 연결합니다.
              비밀은 실행 환경이 보관하고, 화면은 연결 상태만 읽도록 설계합니다.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("inbox");
  const [filter, setFilter] = useState<Filter>("decision");
  const [cases, setCases] = useState(() => structuredClone(demoCases));
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
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
  const nav: { id: Page; title: string; icon: IconName }[] = [
    { id: "inbox", title: "판단함", icon: "inbox" },
    { id: "status", title: "상태", icon: "status" },
    { id: "connections", title: "연결 안내", icon: "connect" },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#main"
          onClick={() => setPage("inbox")}
          aria-label="oh-my-SRE 판단함"
        >
          <span className="brand-mark">
            <Icon name="status" size={21} />
          </span>
          oh-my-SRE
        </a>
        <div className="workspace">
          <span className="workspace-avatar">D</span>
          <div>
            <strong>데모 워크스페이스</strong>
            <span>합성 데이터</span>
          </div>
        </div>
        <nav aria-label="주요 메뉴">
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.title}</span>
              {item.id === "inbox" && <span className="nav-count">{needsDecision.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Dialog.Root>
            <Dialog.Trigger>
              <button className="agent-button">
                <span className="agent-symbol">
                  <Icon name="spark" size={18} />
                </span>
                <span>
                  <strong>에이전트</strong>
                  <small>읽기 전용 설계</small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="440px">
              <Dialog.Title>읽기 전용으로 조사합니다</Dialog.Title>
              <Dialog.Description size="2" color="gray">
                합성 데모 · 실제 에이전트 미연결
              </Dialog.Description>
              <div className="agent-description">
                <p>
                  조사는 근거를 읽고 가설과 다음 행동을 정리합니다. 실제 복구는 사람 판단 뒤 외부
                  수동 절차로 진행합니다.
                </p>
                <p>이 데모에서는 에이전트를 실행하거나 관측·모델 API를 호출하지 않습니다.</p>
              </div>
              <Dialog.Close>
                <Button style={{ width: "100%" }}>확인</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            워크스페이스 <span className="breadcrumb-divider">/</span>{" "}
            {nav.find((item) => item.id === page)?.title}
          </span>
          <span className="demo-label">
            <span />
            합성 데모 · 실제 운영 연결 없음
          </span>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {page === "inbox" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">필요한 일에만, 주의를</p>
                <h1 ref={headingRef} tabIndex={-1}>
                  지금 필요한 판단
                </h1>
                <p>
                  {needsDecision.length > 0
                    ? `근거를 확인한 ${needsDecision.length}건의 사건이 사람의 판단을 기다리고 있어요.`
                    : "지금 검토를 기다리는 데모 사건이 없어요."}
                </p>
              </div>
              <div className="overview-line">
                <span>
                  <Icon name="shield" size={15} />
                  읽기 전용 조사
                </span>
                <span>
                  예시 비용 <strong>$0.18</strong> / $1.00
                </span>
                <span>
                  <Icon name="clock" size={15} />
                  마지막 합성 관측 10:12
                </span>
              </div>
              <div className="inbox-toolbar">
                <div className="filters" role="group" aria-label="사건 필터">
                  {(
                    [
                      { id: "decision", title: "판단 필요", count: needsDecision.length },
                      { id: "investigation", title: "조사 상태", count: investigations.length },
                      { id: "all", title: "전체", count: cases.length },
                    ] as const
                  ).map((item) => (
                    <button
                      aria-pressed={filter === item.id}
                      className={filter === item.id ? "filter active" : "filter"}
                      key={item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.title}
                      <span>{item.count}</span>
                    </button>
                  ))}
                </div>
                <span className="list-order">최신순</span>
              </div>
              <div className="case-list">
                {visible.length === 0 ? (
                  <div className="empty-state">
                    <Icon name="inbox" size={30} />
                    <h2>이 필터에는 사건이 없어요</h2>
                    <p>다른 기록은 전체 목록에서 볼 수 있어요.</p>
                    <Button variant="soft" onClick={() => setFilter("all")}>
                      전체 보기
                    </Button>
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
                      <span
                        className={
                          item.decision !== null && item.decision !== "reviewed"
                            ? "case-symbol attention"
                            : "case-symbol"
                        }
                      >
                        <Icon name={item.decision !== null ? "inbox" : "clock"} size={20} />
                      </span>
                      <span className="case-copy">
                        <span className="case-meta">
                          <CaseBadge item={item} />
                          <span>{item.service}</span>
                        </span>
                        <strong>{item.title}</strong>
                        <span className="case-preview">{item.preview}</span>
                      </span>
                      <span className="case-trailing">
                        <time>{item.updated}</time>
                        <Icon name="arrow" size={17} />
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
            <button
              onClick={() => {
                setCases(structuredClone(demoCases));
                setNotice("데모 상태를 초기화했습니다.");
                setFilter("decision");
              }}
            >
              데모 초기화
            </button>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={!!selectedCase}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Content
          className="case-dialog"
          maxWidth="680px"
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
                setNotice("데모 기록만 변경했습니다. 실제 운영 작업은 실행되지 않았습니다.");
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
