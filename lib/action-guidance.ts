export type ActionGuidance = { where: string; how: string; officialUrl?: string };

const airline = "이용 항공사 앱·웹사이트, 알림 또는 공항 항공사 카운터";
const airport = "인천공항 운항정보·전광판과 탑승구 안내";
const map = "https://www.airport.kr/geomap/ap_ko/view.do?alertType=0&tmnlId=P01&type=2";
const guidance: Record<string, ActionGuidance> = {
  "check-time": { where: airport, how: "예정·변경시각과 현재 탑승구를 비교하고 조회 시각을 확인하세요." },
  "changed-time": { where: airport, how: "화면의 예정·변경시각을 확인한 뒤 항공사 알림과 대조하세요." },
  "changed-gate": { where: airport, how: "현재 게이트를 확인하고 이전에 저장한 안내와 비교하세요. 변경이 확인될 때만 이동하세요." },
  "gate-walk": { where: "공항 공식 지도와 현재 위치", how: "터미널·층·구역을 확인하고 탑승구까지의 이동시간을 직접 확인하세요.", officialUrl: map },
  "airline-message": { where: airline, how: "항공사의 지연 사유·예상시각 안내를 확인하고 화면을 저장하세요." },
  "alerts": { where: "이용 항공사 앱·문자 알림", how: "예약에 등록된 연락처와 알림 설정을 확인하세요." },
  "documents": { where: "휴대전화 또는 소지한 여행 서류", how: "탑승권, 여권과 예약 정보를 바로 꺼낼 수 있게 준비하세요." },
  "later-plans": { where: "연결편 예약 화면과 이후 일정", how: "변경된 시각을 기준으로 환승·예약 여유를 확인하세요." },
  "short-facility": { where: "현재 구역의 시설 목록과 공항 지도", how: "복귀 시간을 먼저 확인하고 가까운 시설만 살펴보세요.", officialUrl: map },
  "connection-impact": { where: "연결편 예약 화면과 이용 항공사", how: "새 도착 예상시각과 연결편 출발시각을 비교하세요." },
  "meal-rest": { where: "아래 시설 추천과 공항 공식 지도", how: "현재 위치와 같은 구역의 시설을 고르고 복귀 시간을 확인하세요.", officialUrl: map },
  "save-screen": { where: "항공사 앱·문자와 이 화면", how: "편명, 예정·변경시각, 조회 시각이 보이도록 화면을 저장하세요." },
  "meal-support": { where: airline, how: "식사·통신 등 현장 지원 가능 여부와 제공 위치를 문의하세요." },
  "receipts": { where: "개인 보관함 또는 휴대전화", how: "탑승권, 안내 화면, 실제 지출 영수증을 날짜별로 모아 두세요." },
  "reservation-change": { where: "숙소·교통 예약 앱 또는 고객센터", how: "무료 변경·취소 마감시각을 확인하고 변경 전 화면을 저장하세요." },
  "continued-operation": { where: airport, how: "변경시각·운항 상태를 다시 확인하고 항공사 안내와 대조하세요." },
  "long-support": { where: airline, how: "식사·숙박·교통 지원 범위와 신청 장소를 문의하세요." },
  "long-reservations": { where: "숙소·교통 예약 앱 또는 고객센터", how: "변경·취소 가능 시간을 확인하고 수수료 안내를 저장하세요." },
  "long-proof": { where: airline, how: "지연확인서 발급과 영수증 제출 요건을 확인하세요." },
  "cancel-support": { where: airline, how: "대체편 대기 중 식사·숙박·교통 지원 가능 여부를 문의하세요." },
  "cancel-reservations": { where: "숙소·교통 예약 앱 또는 고객센터", how: "결항 사실을 알리고 변경·취소 조건과 수수료를 확인하세요." },
  "cancel-transfer": { where: "항공사 환승 데스크", how: "연결편 편명과 예약번호로 재예약 창구를 확인하세요." },
  "transfer-arrival": { where: "항공사 앱과 공항 도착편 정보", how: "변경된 도착 예상시각이 표시되는지 확인하고 연결편 시각과 비교하세요." },
  "transfer-minimum": { where: "연결편 항공사 또는 환승 데스크", how: "터미널 이동과 보안검색 시간을 포함해 최소 환승 가능시간을 문의하세요." },
  "transfer-flight": { where: "연결편 항공사 앱 또는 공항 운항정보", how: "연결편 편명으로 출발시각과 탑승구를 확인하세요." },
  "alternate": { where: airline, how: "예약번호와 편명을 준비해 가능한 대체편, 연결편 영향, 비용을 문의하세요." },
  "refund": { where: airline, how: "미사용 구간의 환불 가능 여부와 대체편 조건을 함께 확인하세요." },
  "cancel-choice": { where: airline, how: "대체편과 미사용 구간 환불 조건을 비교하고 접수 내역을 저장하세요." },
  "cancel-route": { where: airline, how: "대체편의 편명·출발시각·터미널·게이트를 서면이나 화면으로 확인하세요." },
  "cancel-baggage": { where: "항공사 수하물 데스크 또는 수취대 안내", how: "수하물표를 보여주고 반환 장소와 대체편 연결 여부를 확인하세요." },
  "bag-status": { where: "항공사 수하물 데스크", how: "수하물표 번호로 현재 처리 상태를 문의하세요." },
  "bag-rebook": { where: "항공사 수하물 데스크", how: "대체편으로 자동 연결되는지, 재위탁이 필요한지 확인하세요." },
  "bag-tag": { where: "수하물표 또는 휴대전화 사진", how: "수하물표 번호를 보관하고 항공사 문의 시 제시하세요." },
  "delay-cert": { where: airline, how: "지연확인서 발급 경로와 발급 가능 시각을 문의하고 신청 내역을 보관하세요." },
  "cancel-cert": { where: airline, how: "결항확인서 발급을 요청하고 편명·날짜·사유 기재 여부를 확인하세요." },
  "insured-proof": { where: "가입한 보험사의 앱·약관·고객센터", how: "지연·결항 특약의 시간 조건과 필요한 확인서·탑승권·영수증을 확인하세요." },
  "insurance-terms": { where: "가입한 보험사의 앱·약관·고객센터", how: "지수형 특약의 보장 시작시간과 청구 조건을 확인하세요." },
  "long-insurance": { where: "가입한 보험사의 앱·약관·고객센터", how: "실비형 특약의 보장 시간, 지출 항목, 영수증 조건을 확인하세요." },
  "cancel-insurance": { where: "가입한 보험사의 앱·약관·고객센터", how: "대체편 제공 시간 등 결항 특약 조건과 제출 서류를 확인하세요." },
  "transfer-contact": { where: "이용 항공사 환승 데스크·고객센터", how: "변경된 도착시각과 연결편 편명을 제시해 재예약 가능성을 문의하세요." },
  "transfer-desk": { where: "공항 환승 데스크 또는 항공사 카운터", how: "연결편을 놓쳤다면 예약번호와 탑승권을 제시하세요." },
  "support-route": { where: "공항 공식 지도·안내데스크", how: "가까운 엘리베이터, 의료·유아·교통약자 시설을 확인하세요.", officialUrl: map },
  "booking-policy": { where: "숙소·교통 예약 앱 또는 고객센터", how: "무료 변경·취소 기한과 수수료 조건을 확인하세요." },
  "booking-contact": { where: "숙소·교통 예약 업체", how: "지연·결항 사실을 전달하고 변경 내역과 수수료 영수증을 저장하세요." },
  "support-request": { where: "이용 항공사 또는 공항 안내데스크", how: "필요한 이동지원과 현재 위치를 알리고 가능한 지원을 문의하세요." },
  "crew-first": { where: "기내 승무원 안내", how: "안전 안내와 하선·환승 안내를 우선 따르세요." },
  "onboard-time": { where: "기내 안내 또는 항공사 앱의 저장된 정보", how: "인터넷 연결이 되면 최신 출발·도착시각과 연결편을 다시 확인하세요." },
  "after-landing": { where: "도착 공항의 항공사·환승 데스크", how: "착륙 후 연결편과 수하물 처리 창구를 확인하세요." },
};

export function guidanceFor(id: string): ActionGuidance {
  return guidance[id] ?? { where: airline, how: "현재 운항정보와 개인 예약 조건을 확인하고 필요한 화면이나 답변을 저장하세요." };
}
