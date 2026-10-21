import type { HistoryDay, DayState } from "./sds/uptime";
export type Decision = "pending" | "held" | "reviewed" | null;
export interface SreCase {
  id: string;
  title: string;
  service: string;
  priority: "P1" | "P2";
  investigation: "waiting_for_human" | "waiting_for_observation" | "budget_paused";
  decision: Decision;
  updated: string;
  models: { investigation: string; review: string };
  preview: string;
  summary: {
    situation: string;
    confirmed: string;
    unknown: string;
    next: string;
    decision: string;
  };
  evidence: { title: string; detail: string; time: string }[];
  history: { time: string; title: string; detail: string }[];
}

export const demoCases: SreCase[] = [
  {
    id: "INC-001",
    title: "이벤트 처리 지연",
    service: "이벤트 파이프라인",
    priority: "P1",
    investigation: "waiting_for_human",
    decision: "pending",
    updated: "10:12",
    models: { investigation: "성공 · 10:08", review: "검토 완료 · 10:10" },
    preview: "지연 지속 · 제한된 재처리 제안 검토",
    summary: {
      situation: "처리 지연 12분 지속. 제한된 재처리 제안 검토 필요.",
      confirmed: "최근 3회 처리 시간 증가와 대기량 동반 상승 확인.",
      unknown: "영향 범위와 최종 전달 여부 미확인.",
      next: "신규 관측에서 지속·악화·회복 확인. 의미 있는 변화 발생 시 재조사.",
      decision: "제한된 재처리 제안 검토. 실제 실행은 별도 수동 절차.",
    },
    evidence: [
      { title: "처리 지연 지속", detail: "3회 관측 · 처리 시간 18초", time: "10:12" },
      { title: "대기량 동반 상승", detail: "동일 관측 구간의 증가 추세", time: "10:10" },
      {
        title: "전달 완료 미확인",
        detail: "최종 전달 근거 부재. 성공·유실 판정 보류.",
        time: "10:08",
      },
    ],
    history: [
      { time: "10:12", title: "사람 판단 요청", detail: "조치 제안과 미확인 범위 기록" },
      { time: "10:10", title: "독립 검토 완료", detail: "근거의 범위와 불확실성 대조" },
      { time: "10:08", title: "신규 근거 조사 완료", detail: "처리 지연과 대기량의 상관 확인" },
      { time: "10:05", title: "관측 범위 확인", detail: "동일 구간 근거 대조" },
      { time: "10:02", title: "재점검 대기", detail: "동일 근거. 외부 알림 추가 없음." },
      { time: "10:00", title: "최초 징후 기록", detail: "단일 징후에 대한 확정 판정 보류" },
    ],
  },
  {
    id: "INC-002",
    title: "메모리 여유 감소",
    service: "검색 서비스",
    priority: "P2",
    investigation: "waiting_for_human",
    decision: "pending",
    updated: "09:54",
    models: { investigation: "추세 비교 완료 · 09:50", review: "검토 대기 · 미실행" },
    preview: "용량 변경 검토 시간대 결정 필요",
    summary: {
      situation: "메모리 여유 감소. 용량 변경 시점 검토 필요.",
      confirmed: "여유 감소 추세 확인. 요청 오류 증가는 없음.",
      unknown: "추세 지속 기간과 변경 시 영향 미확인.",
      next: "사용량 관측 지속. 악화 시 신규 근거로 재조사.",
      decision: "용량 변경 검토 시간대 결정. 실행은 별도 절차.",
    },
    evidence: [
      { title: "메모리 여유 감소 추세", detail: "관측 구간 내 요청 오류 증가 없음", time: "09:54" },
    ],
    history: [
      { time: "09:54", title: "일정 판단 요청", detail: "실제 변경은 별도 절차로 분리" },
      { time: "09:50", title: "사용량 추세 비교", detail: "요청 오류와 여유 동시 대조" },
      { time: "09:45", title: "최초 징후 기록", detail: "단일 관측에 대한 긴급 판정 보류" },
    ],
  },
  {
    id: "INC-003",
    title: "관측 수신 대기",
    service: "전달 서비스",
    priority: "P2",
    investigation: "waiting_for_observation",
    decision: null,
    updated: "09:56",
    models: { investigation: "신규 근거 대기 · 미실행", review: "검토 대기 · 미실행" },
    preview: "관측 공백 · 현재 상태 판정 보류",
    summary: {
      situation: "예정된 관측 미수신.",
      confirmed: "마지막 수신 시각과 공백 확인.",
      unknown: "공백 구간의 서비스 상태와 영향 범위 미확인.",
      next: "공백 지속·범위 확대·관측 회복 여부 재점검.",
      decision: "현재 사람 결정 없음. 미확인만으로 승인 요청 생성 안 함.",
    },
    evidence: [
      {
        title: "마지막 수신 이후 관측 공백",
        detail: "빈 결과에 대한 정상·유실 판정 보류",
        time: "09:56",
      },
    ],
    history: [{ time: "09:56", title: "관측 공백 기록", detail: "고객 장애 판정과 분리" }],
  },
  {
    id: "INC-004",
    title: "조사 예산 도달",
    service: "조회 API",
    priority: "P2",
    investigation: "budget_paused",
    decision: null,
    updated: "09:40",
    models: { investigation: "한도 도달 · 추가 실행 없음", review: "검토 대기 · 미실행" },
    preview: "기존 근거 보존 · 다음 예산 기간 대기",
    summary: {
      situation: "일일 모델 조사 한도 도달. 추가 조사 중지.",
      confirmed: "마지막 근거와 실행 기록 보존.",
      unknown: "추가 조사 없이 원인·회복 확정 불가.",
      next: "다음 예산 기간에 근거와 정책을 대조한 뒤 재개 판단.",
      decision: "자동 한도 확대·사람 승인 요청 없음.",
    },
    evidence: [
      {
        title: "예산 정책에 따른 재호출 중지",
        detail: "기존 조사 결과와 미확인 상태 보존",
        time: "09:40",
      },
    ],
    history: [{ time: "09:40", title: "추가 조사 보류", detail: "저장 근거와 미확인 상태 보존" }],
  },
];

function syntheticDays(state: (index: number) => DayState): HistoryDay[] {
  return Array.from({ length: 90 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 6, 24 + index)).toISOString().slice(0, 10),
    state: state(index),
    windowMinutes: index === 89 ? 720 : 1440,
  }));
}

export const serviceObservations = [
  {
    name: "이벤트 파이프라인",
    scope: "수집 / 처리",
    state: "partial" as const,
    last: "10:12",
    action: "변화 재점검",
    unknown: "영향 범위 미확인",
    days: syntheticDays((index) =>
      [12, 43].includes(index)
        ? "error"
        : index >= 83 || (index >= 55 && index <= 60)
          ? "partial"
          : "observed",
    ),
  },
  {
    name: "검색 서비스",
    scope: "조회",
    state: "stable" as const,
    last: "10:10",
    action: "기존 근거 대조",
    unknown: "회복 여부 별도 검증 필요",
    days: syntheticDays((index) => ([10, 21].includes(index) ? "partial" : "observed")),
  },
  {
    name: "전달 서비스",
    scope: "전달",
    state: "observation_gap" as const,
    last: "09:56",
    action: "다음 관측 대기",
    unknown: "현재 상태 미확인",
    days: syntheticDays((index) => (index >= 81 ? "unknown" : "observed")),
  },
];
