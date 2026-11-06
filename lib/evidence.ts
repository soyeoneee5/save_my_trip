import type { Situation } from "./journey";

export type EvidenceBand = "none" | "two-hours" | "four-hours" | "long-delay" | "cancelled";
export type EvidenceItem = { id: string; title: string; detail: string; bands: EvidenceBand[]; when?: "baggage" | "hotel" | "transport" | "insurance" | "insurance-expense" };

export function evidenceBand(status: Situation["status"], minutes: number): EvidenceBand {
  if (status === "cancelled") return "cancelled";
  if (minutes < 120) return "none";
  if (minutes < 240) return "two-hours";
  if (minutes < 780) return "four-hours";
  return "long-delay";
}

const delayed: EvidenceBand[] = ["two-hours", "four-hours", "long-delay"];
const expanded: EvidenceBand[] = ["four-hours", "long-delay"];
const all: EvidenceBand[] = [...delayed, "cancelled"];

export const evidenceCatalog: EvidenceItem[] = [
  { id: "ticket", title: "항공권 또는 예약 확인서", detail: "항공사 앱이나 예약 이메일에서 저장하세요.", bands: all },
  { id: "boarding-pass", title: "탑승권", detail: "모바일 탑승권은 화면을 저장하고 종이 탑승권은 보관하세요.", bands: all },
  { id: "delay-certificate", title: "지연·결항 확인서", detail: "편명과 지연시간이 기재된 항공사 확인서를 요청하세요. 보험사에서 요구하는 형식을 확인하세요.", bands: all },
  { id: "airline-message", title: "항공사 문자 또는 이메일", detail: "지연·결항 안내와 발송 시각이 보이도록 저장하세요.", bands: expanded.concat("cancelled") },
  { id: "time-screens", title: "변경 전후 항공편 시간 화면", detail: "예정·변경시각과 조회 시각이 보이도록 저장하세요.", bands: expanded },
  { id: "meal-receipt", title: "식사 영수증", detail: "항공사 지원 가능 여부를 확인하고 실제 지출 영수증을 보관하세요.", bands: expanded.concat("cancelled") },
  { id: "hotel-receipt", title: "숙박 영수증", detail: "숙소 이용 시 보관하세요.", bands: ["long-delay", "cancelled"], when: "hotel" },
  { id: "transport-receipt", title: "교통비 영수증", detail: "교통편 변경이나 이동에 쓴 비용을 보관하세요.", bands: ["long-delay", "cancelled"], when: "transport" },
  { id: "airline-contact", title: "항공사 문의 내용과 답변", detail: "문의 시각, 상담 내용, 답변을 기록하세요.", bands: expanded.concat("cancelled") },
  { id: "insurance-policy", title: "여행자보험 가입증명서와 지연·결항 특약 약관", detail: "가입한 특약의 보장 시작시간과 실제 지출 보장 항목을 확인하세요.", bands: all, when: "insurance" },
  { id: "insurance-claim-form", title: "보험사 보험금 청구서·개인정보 동의서", detail: "가입한 보험사의 청구 양식을 확인해 보험사에 직접 제출하세요. 이 서비스에는 신분증 등 개인정보를 입력하지 마세요.", bands: all, when: "insurance" },
  { id: "insurance-expense-receipt", title: "실제로 지출한 식음료·편의시설 비용 영수증", detail: "실손형 특약의 보장 대상 비용을 직접 지출했다면 영수증을 보관하세요. 항공사가 제공한 비용은 중복 청구하지 말고 보험사에 알리세요.", bands: ["two-hours"], when: "insurance-expense" },
  { id: "rebooking-refund", title: "대체편 또는 환불 안내", detail: "대체편 출발시각·터미널 또는 환불 접수 내역을 저장하세요.", bands: ["long-delay", "cancelled"] },
  { id: "bag-tag", title: "수하물표와 수하물 처리 안내", detail: "수하물 반환 또는 대체편 연결 여부를 항공사에 확인하세요.", bands: ["cancelled"], when: "baggage" },
];

export function evidenceForSituation(s: Situation): EvidenceItem[] {
  const band = evidenceBand(s.status, s.delayMinutes);
  return evidenceCatalog.filter(item => item.bands.includes(band) && (!item.when || (item.when === "insurance-expense" ? s.insurance && (s.insuranceType === "expense" || s.insuranceType === "both") : s[item.when])));
}

export function consumerDisputeRate(s: Situation): string | null {
  if (s.status === "cancelled" || s.delayMinutes < 120) return null;
  if (s.delayMinutes <= 240) return "해당 구간 운임의 10% 배상 검토";
  if (s.delayMinutes <= 720) return "해당 구간 운임의 20% 배상 검토";
  return "해당 구간 운임의 30% 배상 검토";
}
