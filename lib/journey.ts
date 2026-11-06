import type { FlightDirection, FlightRecord } from "./types";
import { guidanceFor } from "./action-guidance";

export type DelayBand = "normal" | "30-59" | "60-119" | "120-239" | "240-plus" | "cancelled";
export type Location = "travel" | "checkin" | "airside" | "gate" | "onboard" | "arrival";
export type Preference = "rest" | "cafe" | "food" | "lounge" | "shopping" | "convenience";
export type Situation = {
  direction: FlightDirection | "transfer"; location: Location; status: "normal" | "delayed" | "cancelled";
  delayMinutes: number; baggage: boolean; connection: boolean; hotel: boolean; transport: boolean;
  insurance: boolean; child: boolean; senior: boolean; pregnant: boolean; accessibility: boolean;
  preference: Preference; freeFirst: boolean; outboundMinutes: number | null; returnMinutes: number | null;
  cutoffMinutes: number; safetyMinutes: number;
};
export const defaultSituation: Situation = { direction:"departure",location:"travel",status:"normal",delayMinutes:0,baggage:false,connection:false,hotel:false,transport:false,insurance:false,child:false,senior:false,pregnant:false,accessibility:false,preference:"rest",freeFirst:true,outboundMinutes:null,returnMinutes:null,cutoffMinutes:40,safetyMinutes:20 };
export function delayBand(s: Situation): DelayBand {
  if(s.status === "cancelled") return "cancelled";
  if(s.status === "normal") return "normal";
  if(s.delayMinutes < 30) return "normal";
  if(s.delayMinutes < 60) return "30-59";
  if(s.delayMinutes < 120) return "60-119";
  if(s.delayMinutes < 240) return "120-239";
  return "240-plus";
}
export function applyManualSituation(s:Situation,patch:Partial<Pick<Situation,"status"|"delayMinutes">>):Situation{const next={...s,...patch};if(patch.status==="normal")next.delayMinutes=0;if(patch.delayMinutes!==undefined&&patch.delayMinutes>=30&&next.status==="normal")next.status="delayed";return next;}
export type ChecklistItem = { id:string; title:string; detail:string; where:string; how:string; officialUrl?:string; statuses:Situation["status"][]; bands:DelayBand[]; locations:Location[]; directions:Situation["direction"][]; baggage?:boolean; connection?:boolean; hotelOrTransport?:boolean; insurance?:boolean; accessibility?:boolean; priority:number; required:boolean; offline:boolean; needsConnection:boolean };
const ALL_LOCATIONS: Location[]=["travel","checkin","airside","gate","onboard","arrival"];
const ALL_DIRECTIONS: Situation["direction"][]=["departure","arrival","transfer"];
const ALL_BANDS:DelayBand[]=["normal","30-59","60-119","120-239","240-plus","cancelled"];
const DISRUPTION_BANDS:DelayBand[]=["30-59","60-119","120-239","240-plus","cancelled"];
const TWO_HOUR_BANDS:DelayBand[]=["120-239","240-plus","cancelled"];
export function makeItem(id:string,title:string,bands:DelayBand[],priority=50,extra:Partial<ChecklistItem>={}):ChecklistItem { return {id,title,detail:title,...guidanceFor(id),statuses:["normal","delayed","cancelled"],bands,locations:ALL_LOCATIONS,directions:ALL_DIRECTIONS,priority,required:true,offline:true,needsConnection:false,...extra}; }
export const checklistCatalog:ChecklistItem[]=[
  makeItem("check-time","출발시각과 탑승구 재확인",["normal"],10),makeItem("alerts","항공사 또는 서비스 알림 설정",["normal"],30,{needsConnection:true,offline:false}),makeItem("gate-walk","탑승구까지 필요한 이동시간 확인",["normal"],20),makeItem("documents","탑승권과 여권 준비",["normal"],15),
  makeItem("changed-time","변경된 출발시각 확인",["30-59","60-119","120-239","240-plus"],10),makeItem("changed-gate","탑승구 변경 여부 확인",["30-59","60-119","120-239","240-plus"],12),makeItem("later-plans","이후 일정 확인",["30-59"],20),makeItem("short-facility","짧게 이용할 수 있는 가까운 시설 확인",["30-59"],35),
  makeItem("airline-message","항공사 안내 확인",["60-119"],10),makeItem("connection-impact","이후 예약 일정 영향 확인",["60-119"],20),makeItem("meal-rest","식사 또는 휴식 장소 추천 확인",["60-119"],30),makeItem("save-screen","탑승권과 지연 안내 화면 저장",["60-119","120-239","240-plus"],15),
  makeItem("alternate","항공사에 대체편 가능 여부 문의",["120-239"],10),makeItem("meal-support","식사 등 현장 지원 여부 문의",["120-239"],20),makeItem("delay-cert","지연확인서 발급 방법 확인",["120-239"],15),makeItem("receipts","탑승권, 안내 화면, 영수증 보관",["240-plus","cancelled"],25),makeItem("insurance-terms","여행자보험 보장 조건 확인",["120-239"],35,{insurance:true}),makeItem("reservation-change","숙소와 교통 예약 변경 가능 여부 확인",["120-239"],40,{hotelOrTransport:true}),
  makeItem("continued-operation","운항 지속 여부와 예상 출발시간 재확인",["240-plus"],10),makeItem("refund","대체편 또는 환불 가능 여부 문의",["240-plus"],12),makeItem("long-support","식사·숙박·교통 지원 여부 문의",["240-plus"],20),makeItem("long-reservations","숙소와 교통 예약 변경",["240-plus"],28,{hotelOrTransport:true}),makeItem("long-proof","지연확인서와 관련 증빙 확보",["240-plus"],22),makeItem("long-insurance","여행자보험 청구 조건과 필요 서류 확인",["240-plus"],32,{insurance:true}),
  makeItem("cancel-choice","항공사에서 대체편 또는 환불 선택",["cancelled"],1),makeItem("cancel-route","대체편 출발시각과 공항·터미널 확인",["cancelled"],2),makeItem("cancel-baggage","위탁수하물 반환 여부와 수취 장소 확인",["cancelled"],3,{baggage:true}),makeItem("cancel-cert","결항확인서 발급",["cancelled"],4),makeItem("cancel-support","식사·숙박·교통 지원 여부 문의",["cancelled"],5),makeItem("cancel-reservations","숙소와 교통 예약 변경 또는 취소",["cancelled"],6,{hotelOrTransport:true}),makeItem("cancel-insurance","여행자보험 청구 조건과 제출 서류 확인",["cancelled"],8,{insurance:true}),makeItem("cancel-transfer","연결편 재예약 창구 확인",["cancelled"],7,{connection:true}),
  makeItem("transfer-arrival","변경된 도착 예정시각 확인",DISRUPTION_BANDS,45,{connection:true}),makeItem("transfer-minimum","최소 환승 가능시간 검토",DISRUPTION_BANDS,46,{connection:true}),makeItem("transfer-flight","연결편 운항 상태 확인",DISRUPTION_BANDS,47,{connection:true,needsConnection:true,offline:false}),makeItem("transfer-contact","연결편을 놓칠 가능성이 있으면 항공사에 미리 문의",DISRUPTION_BANDS,48,{connection:true}),makeItem("transfer-desk","놓친 경우 환승 데스크와 재예약 창구 확인",DISRUPTION_BANDS,49,{connection:true}),
  makeItem("bag-status","수하물 처리 상태 확인",TWO_HOUR_BANDS,55,{baggage:true}),makeItem("bag-rebook","대체편 수하물 자동 연결 여부 확인",["240-plus","cancelled"],56,{baggage:true}),makeItem("bag-tag","수하물표 보관",TWO_HOUR_BANDS,57,{baggage:true}),makeItem("insured-proof","보험 약관의 보장 시간·요구 증빙 확인",TWO_HOUR_BANDS,60,{insurance:true}),makeItem("booking-policy","숙소·교통 예약의 무료 변경·취소 기한 확인",TWO_HOUR_BANDS,65,{hotelOrTransport:true}),makeItem("booking-contact","예약 업체에 지연·결항 사실 전달하고 변경 화면·수수료 영수증 보관",TWO_HOUR_BANDS,66,{hotelOrTransport:true}),makeItem("support-route","가까운 접근 가능 동선과 의료·유아·교통약자 지원시설 확인",ALL_BANDS,70,{accessibility:true}),makeItem("support-request","항공사 또는 공항에 필요한 지원 요청",ALL_BANDS,71,{accessibility:true}),
  makeItem("crew-first","기내에서는 승무원 안내를 우선 확인",ALL_BANDS,0,{locations:["onboard"]}),makeItem("onboard-time","예상 출발·도착시각 확인",ALL_BANDS,8,{locations:["onboard"]}),makeItem("after-landing","착륙 후 항공사 데스크 방문 위치 확인",ALL_BANDS,40,{locations:["onboard"]}),
];
export function applicableItems(s:Situation):ChecklistItem[] { const band=delayBand(s); return checklistCatalog.filter(i=>i.bands.includes(band)&&i.statuses.includes(s.status)&&i.locations.includes(s.location)&&i.directions.includes(s.direction)&& (i.baggage===undefined||i.baggage===s.baggage)&&(i.connection===undefined||i.connection===s.connection)&&(i.hotelOrTransport===undefined||i.hotelOrTransport===(s.hotel||s.transport))&&(i.insurance===undefined||i.insurance===s.insurance)&&(i.accessibility===undefined||i.accessibility===(s.child||s.senior||s.pregnant||s.accessibility))).sort((a,b)=>a.priority-b.priority); }
export function immediateItems(s:Situation):ChecklistItem[]{const active=applicableItems(s),first=active.slice(0,4),receipts=active.find(item=>item.id==="receipts");return receipts&&!first.some(item=>item.id==="receipts")?[...first,receipts]:first;}
export function mergeItemProgress(existing:Record<string,boolean>,active:ChecklistItem[]):Record<string,boolean>{const next={...existing};for(const item of active) if(!(item.id in next)) next[item.id]=false;return next;}
export function resolveFlightConflict(server:FlightRecord,manual:{status?:Situation["status"];delayMinutes?:number}|null){return {server:{status:server.status,delayMinutes:server.delayMinutes,gate:server.gate,estimatedDatetime:server.estimatedDatetime},manual,conflict:!!manual&&(manual.delayMinutes!==undefined&&manual.delayMinutes!==server.delayMinutes||manual.status!==undefined&&manual.status!==flightStatus(server))};}
export function flightStatus(f:FlightRecord):Situation["status"]{return f.stage==="cancelled"?"cancelled":f.status.includes("지연")||(f.delayMinutes??0)>=30?"delayed":"normal";}
