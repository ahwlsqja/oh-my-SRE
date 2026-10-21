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
    title: "이벤트 처리 지연이 이어지고 있어요",
    service: "이벤트 파이프라인",
    priority: "P1",
    investigation: "waiting_for_human",
    decision: "pending",
    updated: "10:12",
    models: { investigation: "최근 조사 성공 · 10:08", review: "근거 대조 완료 · 10:10" },
    preview: "제한된 재처리 제안을 검토할 근거가 모였어요.",
    summary: {
      situation: "이벤트 처리 지연이 12분 동안 이어졌고, 다음 작업을 결정해야 해요.",
      confirmed: "최근 세 번의 관측에서 처리 시간이 기준 구간보다 길었고 대기량도 늘었어요.",
      unknown: "영향을 받은 범위와 최종 전달 여부는 아직 확인되지 않았어요.",
      next: "새 관측에서 지연이 줄어드는지 계속 확인하고, 달라진 근거가 있을 때 다시 조사해요.",
      decision: "제한된 재처리 제안을 검토해 주세요. 실행은 별도의 수동 절차로 진행해야 해요.",
    },
    evidence: [
      {
        title: "처리 지연이 지속됐어요",
        detail: "3회 관측 · 처리 시간 18초 · 모든 수치는 합성 예시",
        time: "10:12",
      },
      {
        title: "대기량이 함께 늘었어요",
        detail: "같은 관측 구간에서 증가 추세를 확인한 합성 근거",
        time: "10:10",
      },
      {
        title: "전달 완료는 미확인이에요",
        detail: "마지막 전달 단계의 근거가 없어 성공이나 유실을 단정하지 않아요.",
        time: "10:08",
      },
    ],
    history: [
      {
        time: "10:12",
        title: "구체적인 판단을 요청했어요",
        detail: "제한된 재처리 제안과 미확인 범위를 함께 남겼어요.",
      },
      {
        time: "10:10",
        title: "독립 검토가 근거를 대조했어요",
        detail: "조사 결론의 확인 범위와 불확실성을 분리했어요.",
      },
      {
        time: "10:08",
        title: "새 근거로 조사를 마쳤어요",
        detail: "처리 지연과 대기량 증가를 함께 살폈어요.",
      },
      {
        time: "10:05",
        title: "관측 범위를 다시 확인했어요",
        detail: "같은 구간의 근거만 사용했어요.",
      },
      {
        time: "10:02",
        title: "다음 관측을 기다렸어요",
        detail: "변화가 없어 외부 알림은 추가하지 않았어요.",
      },
      {
        time: "10:00",
        title: "최초 징후를 기록했어요",
        detail: "첫 징후를 확정 장애나 유실로 바꾸지 않았어요.",
      },
    ],
  },
  {
    id: "INC-002",
    title: "메모리 여유가 줄고 있어요",
    service: "검색 서비스",
    priority: "P2",
    investigation: "waiting_for_human",
    decision: "pending",
    updated: "09:54",
    models: { investigation: "추세 비교 완료 · 09:50", review: "추가 검토 대기 · 미실행" },
    preview: "용량 변경을 검토할 시간대를 정해 주세요.",
    summary: {
      situation: "검색 서비스의 메모리 여유가 줄어 용량 변경 시점을 검토할 필요가 있어요.",
      confirmed: "합성 관측에서는 여유가 점차 줄었고 요청 오류는 늘지 않았어요.",
      unknown: "현재 추세가 언제까지 이어질지와 변경 중 영향은 아직 확인되지 않았어요.",
      next: "관측을 이어가고 사용량이 악화되면 새로운 근거로 다시 조사해요.",
      decision: "용량 변경을 검토할 시간대를 정해 주세요. 이 화면에서는 변경을 실행하지 않아요.",
    },
    evidence: [
      {
        title: "메모리 여유가 줄었어요",
        detail: "합성 관측의 감소 추세이며 실제 서비스 측정값이 아니에요.",
        time: "09:54",
      },
    ],
    history: [
      {
        time: "09:54",
        title: "일정 판단을 요청했어요",
        detail: "실제 변경은 별도 절차로 남겼어요.",
      },
      {
        time: "09:50",
        title: "사용량 추세를 비교했어요",
        detail: "오류 증가가 없다는 합성 근거도 함께 확인했어요.",
      },
      {
        time: "09:45",
        title: "최초 징후를 기록했어요",
        detail: "단일 관측만으로 긴급 상황을 만들지 않았어요.",
      },
    ],
  },
  {
    id: "INC-003",
    title: "다음 수집 결과를 기다리고 있어요",
    service: "전달 서비스",
    priority: "P2",
    investigation: "waiting_for_observation",
    decision: null,
    updated: "09:56",
    models: { investigation: "새 근거 대기 · 미실행", review: "추가 검토 대기 · 미실행" },
    preview: "관측이 부족해 현재 상태를 판단하지 않았어요.",
    summary: {
      situation: "예정된 다음 관측이 아직 도착하지 않았어요.",
      confirmed: "마지막으로 받은 관측 시각과 수집 공백만 확인했어요.",
      unknown: "관측이 없는 동안의 서비스 상태와 영향 범위는 미확인이에요.",
      next: "공백이 지속되거나 범위가 넓어지는지, 관측이 돌아오는지 확인해요.",
      decision: "지금 필요한 사람 결정은 없어요. 미확인만으로 조치 승인을 요청하지 않아요.",
    },
    evidence: [
      {
        title: "마지막 관측 이후 공백이 있어요",
        detail: "빈 결과를 0이나 정상으로 해석하지 않았어요.",
        time: "09:56",
      },
    ],
    history: [
      {
        time: "09:56",
        title: "관측 공백을 기록했어요",
        detail: "공백 자체를 고객 장애로 확정하지 않았어요.",
      },
    ],
  },
  {
    id: "INC-004",
    title: "저장된 근거를 보존하고 잠시 기다려요",
    service: "조회 API",
    priority: "P2",
    investigation: "budget_paused",
    decision: null,
    updated: "09:40",
    models: { investigation: "한도 도달 · 추가 실행 없음", review: "추가 검토 대기 · 미실행" },
    preview: "오늘의 예시 조사 한도에 도달했어요.",
    summary: {
      situation: "오늘의 예시 모델 조사 한도에 도달해 추가 조사를 잠시 멈췄어요.",
      confirmed: "마지막 조사 근거와 실패·성공 기록은 그대로 남아 있어요.",
      unknown: "추가 조사 없이 현재 원인이나 회복을 확정할 수 없어요.",
      next: "다음 예산 기간에 근거와 정책을 다시 확인한 뒤 조사 재개 여부를 결정해요.",
      decision: "자동으로 한도를 늘리거나 사람 승인을 만들지 않아요.",
    },
    evidence: [
      {
        title: "조사 한도가 재호출을 멈췄어요",
        detail: "합성 비용 사례이며 실제 계정 사용액이 아니에요.",
        time: "09:40",
      },
    ],
    history: [
      {
        time: "09:40",
        title: "추가 모델 조사를 보류했어요",
        detail: "저장된 근거와 미확인 상태는 보존했어요.",
      },
    ],
  },
];

export const serviceObservations = [
  {
    name: "이벤트 파이프라인",
    scope: "수집 · 처리",
    state: "일부 미확인",
    tone: "amber" as const,
    last: "10:12",
    action: "변화가 있는지 재점검",
    unknown: "영향 범위가 아직 확인되지 않았어요.",
    history: "ssssssssssssspppppssssssspppppp",
  },
  {
    name: "검색 서비스",
    scope: "조회",
    state: "신호 안정",
    tone: "gray" as const,
    last: "10:10",
    action: "기존 근거와 비교",
    unknown: "회복 여부는 별도 검증이 필요해요.",
    history: "ssssssssppssssssssssssssssssss",
  },
  {
    name: "전달 서비스",
    scope: "전달",
    state: "관측 대기",
    tone: "gray" as const,
    last: "09:56",
    action: "다음 관측을 기다리는 중",
    unknown: "현재 상태를 판단할 자료가 부족해요.",
    history: "sssssssssssssssssssssuuuuuuuuu",
  },
];
