"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CloudOff, ExternalLink, List, MapPin, Plane, RefreshCw, Wifi } from "lucide-react";
import { applicableItems, checklistCatalog, defaultSituation, flightStatus, mergeItemProgress, resolveFlightConflict, type ChecklistItem, type Situation } from "@/lib/journey";
import { facilityEmptyReason, minutesUntilDeparture, recommendFacilities, safeVisitMinutes, type Facility } from "@/lib/facilities";
import { formatApiDatetime } from "@/lib/flight";
import { statusTone, statusToneLabel } from "@/lib/status";
import type { FlightRecord } from "@/lib/types";

const STORAGE = "flight-rescue-journey-v1";
const AIRPORT_MAP = "https://www.airport.kr/geomap/ap_ko/view.do?alertType=0&tmnlId=P01&type=2";
type Manual = { status?: Situation["status"]; delayMinutes?: number } | null;
type Saved = { situation: Situation; progress: Record<string, boolean>; notes: Record<string, string>; flight: FlightRecord | null; facilities: Facility[]; syncedAt: string | null; facilitySyncedAt?: string | null; manual: Manual; previousGate?: string | null };
const initial: Saved = { situation: defaultSituation, progress: {}, notes: {}, flight: null, facilities: [], syncedAt: null, facilitySyncedAt: null, manual: null, previousGate: null };
const locationLabels: Record<Situation["location"], string> = { travel: "공항으로 이동 중", checkin: "체크인 구역", airside: "보안검색 통과 후", gate: "탑승구", onboard: "비행기 내부", arrival: "도착·환승 구역" };
const preferenceLabels: Record<Situation["preference"], string> = { rest: "무료 휴식", cafe: "카페", food: "식당", lounge: "라운지", shopping: "쇼핑", convenience: "편의시설" };
const terminalLabels: Record<string, string> = { P01: "제1터미널", P02: "탑승동", P03: "제2터미널" };
const zoneLabels = { public: "일반구역", airside: "면세구역", unknown: "구역 확인 필요" };
const format = (value: string | null | undefined) => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음";

function liveDetail(item: ChecklistItem, flight: FlightRecord | null, previousGate?: string | null) {
  if (!flight) return null;
  if (item.id === "changed-time" || item.id === "check-time") return `예정 ${formatApiDatetime(flight.scheduleDatetime)} → 변경 ${formatApiDatetime(flight.estimatedDatetime)}`;
  if (item.id === "changed-gate") return `공항 조회값: 현재 게이트 ${flight.gate}${previousGate && previousGate !== flight.gate ? ` · 이전 조회 게이트 ${previousGate}` : ""} · 조회 ${format(flight.lastUpdatedAt)}`;
  if (item.id === "cancel-route") return `현재 편: ${flight.flightId} · ${flight.terminal} · 게이트 ${flight.gate}. 대체편 정보는 항공사에서 별도 확인하세요.`;
  return null;
}

export function JourneyPanel({ liveFlight, onSituationChange, onRefreshFlight, refreshingFlight }: {
  liveFlight: FlightRecord | null;
  onSituationChange: (situation: Situation) => void;
  onRefreshFlight: () => Promise<void>;
  refreshingFlight: boolean;
}) {
  const [saved, setSaved] = useState<Saved>(initial);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<string | null>(null);
  const [completion, setCompletion] = useState<string | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const lastFlightRef = useRef<FlightRecord | null>(null);
  const facilityInFlight = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) {
          const restored = { ...initial, ...JSON.parse(raw) as Saved };
          lastFlightRef.current = restored.flight;
          setSaved(restored);
        }
      } catch { /* 손상된 저장값은 무시합니다. */ }
      setOnline(navigator.onLine);
      setLoaded(true);
    });
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE, JSON.stringify(saved)); }, [saved, loaded]);
  useEffect(() => { if (loaded) onSituationChange(saved.situation); }, [loaded, saved.situation, onSituationChange]);
  useEffect(() => {
    if (!loaded || !liveFlight) return;
    const before = lastFlightRef.current;
    const same = before?.id === liveFlight.id;
    const differences = same ? [before.estimatedDatetime !== liveFlight.estimatedDatetime ? "변경시간" : "", before.gate !== liveFlight.gate ? "탑승구" : "", before.status !== liveFlight.status ? "운항 상태" : ""].filter(Boolean) : [];
    if (differences.length) setChange(`${differences.join("·")} 정보가 변경됐습니다. 공항 최신 정보를 확인하세요.`);
    lastFlightRef.current = liveFlight;
    setSaved(prev => ({
      ...prev,
      flight: liveFlight,
      previousGate: same && before?.gate !== liveFlight.gate ? before?.gate : prev.previousGate,
      situation: { ...prev.situation, direction: liveFlight.direction, status: prev.manual?.status ?? flightStatus(liveFlight), delayMinutes: prev.manual?.delayMinutes ?? liveFlight.delayMinutes ?? 0 },
      syncedAt: new Date().toISOString(),
    }));
  }, [liveFlight, loaded]);

  const { situation: s, flight, manual } = saved;
  const active = useMemo(() => applicableItems(s), [s]);
  const foundActionIndex = active.findIndex(item => item.id === currentActionId);
  const currentActionIndex = foundActionIndex < 0 ? 0 : foundActionIndex;
  const visibleActions = showAllActions ? active : active.slice(currentActionIndex, currentActionIndex + 1);
  const progress = useMemo(() => mergeItemProgress(saved.progress, active), [saved.progress, active]);
  const conflict = flight ? resolveFlightConflict(flight, manual) : null;
  const visits = useMemo(() => recommendFacilities(saved.facilities, flight, s), [saved.facilities, flight, s]);
  const arrivalPreview = s.location === "onboard" && flight ? saved.facilities.filter(f => f.terminal === flight.terminalCode && f.zone === "public" && (f.kind === s.preference || f.kind === "support")).slice(0, 3) : [];
  const safe = flight ? safeVisitMinutes(flight, s) : null;
  const until = flight ? minutesUntilDeparture(flight) : null;
  const tone = statusTone(s.status === "cancelled" ? "결항" : "지연", s.delayMinutes);

  function update(patch: Partial<Situation>) { setSaved(prev => ({ ...prev, situation: { ...prev.situation, ...patch } })); setCompletion(null); }
  function manualUpdate(patch: NonNullable<Manual>) { setSaved(prev => ({ ...prev, manual: { ...prev.manual, ...patch }, situation: { ...prev.situation, ...patch } })); setCompletion(null); }
  const fetchFacilities = useCallback(async () => {
    if (!navigator.onLine || facilityInFlight.current) return;
    facilityInFlight.current = true;
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/facilities", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "시설 정보를 불러오지 못했습니다.");
      setSaved(prev => ({ ...prev, facilities: payload.facilities as Facility[], facilitySyncedAt: new Date().toISOString() }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "시설 정보 동기화에 실패했습니다."); }
    finally { facilityInFlight.current = false; setSyncing(false); }
  }, []);
  useEffect(() => {
    if (!loaded || !online) return;
    const stale = !saved.facilitySyncedAt || Date.now() - new Date(saved.facilitySyncedAt).getTime() > 24 * 60 * 60 * 1000;
    if (!stale) return;
    const timer = window.setTimeout(() => void fetchFacilities(), 0);
    return () => clearTimeout(timer);
  }, [loaded, online, saved.facilitySyncedAt, fetchFacilities]);
  async function sync() {
    if (!online) { setError("인터넷 연결 후 다시 시도해 주세요."); return; }
    await Promise.all([fetchFacilities(), flight && !flight.isSimulation ? onRefreshFlight() : Promise.resolve()]);
  }
  function complete() {
    onSituationChange(s);
    setCompletion("상황을 저장했습니다. 행동·증빙·시설 추천을 현재 입력에 맞게 다시 정리했습니다.");
    requestAnimationFrame(() => document.getElementById("journey-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  const checkbox = (key: keyof Situation, label: string) => <label className="journey-toggle"><input type="checkbox" checked={Boolean(s[key])} onChange={e => update({ [key]: e.target.checked })} />{label}</label>;

  return <section className="journey-wrap" aria-labelledby="journey-title">
    <div className="journey-heading"><div><p className="section-kicker">My journey</p><h2 className="section-title" id="journey-title">내 상황에 맞는 대응</h2><p className="section-copy">필요한 정보부터 차례로 선택하세요. 입력 내용은 이 기기에 저장됩니다.</p></div><span className={`connection-badge ${online ? "online" : "offline"}`}>{online ? <Wifi size={15} /> : <CloudOff size={15} />} {online ? "온라인" : "오프라인 정보"}</span></div>
    {!online && <div className="status-message error"><AlertTriangle size={20} /><div><h3>저장된 정보를 표시하고 있습니다</h3><p>마지막 동기화: {format(saved.syncedAt)}. 탑승구와 시설 운영시간은 변경됐을 수 있습니다. 실시간 조회는 연결 후 사용할 수 있습니다.</p></div></div>}
    {flight && <div className={`journey-current ${tone}`}><Plane size={19} /><div><strong>{flight.flightId} · {statusToneLabel[tone]} · 공항 정보: {flight.status} / {flight.delayMinutes === null ? "지연시간 확인 필요" : `${flight.delayMinutes}분`} / 게이트 {flight.gate}</strong><small>마지막 성공 조회 {format(saved.syncedAt)} · 출처: {flight.isSimulation ? "시뮬레이션 데이터" : "인천국제공항공사 운항 API"}</small></div></div>}
    {change && <div className="status-message empty" role="status"><AlertTriangle size={19} /><p>{change}</p></div>}
    {conflict?.conflict && <div className="conflict-box"><strong>공항 최신 정보와 내가 입력한 정보가 다릅니다.</strong><p>공항 정보: {conflict.server.status}, {conflict.server.delayMinutes ?? "확인 필요"}분 · 내 입력: {manual?.status ?? "상태 미입력"}, {manual?.delayMinutes ?? "시간 미입력"}분</p><div className="journey-actions"><button type="button" onClick={() => { setSaved(prev => ({ ...prev, manual: null, situation: { ...prev.situation, status: flight ? flightStatus(flight) : prev.situation.status, delayMinutes: flight?.delayMinutes ?? 0 } })); setChange(null); }}>공항 정보 사용</button><button type="button" onClick={() => setChange("내 입력을 유지합니다. 공항 정보를 다시 확인하세요.")}>내 입력 유지</button></div></div>}
    <div className="journey-settings"><h3>1. 현재 상황 입력</h3><div className="journey-steps" aria-label="상황 입력 단계"><button className={phase === 0 ? "selected" : ""} onClick={() => setPhase(0)}>1 위치·상태</button><button className={phase === 1 ? "selected" : ""} onClick={() => setPhase(1)}>2 여행 조건</button><button className={phase === 2 ? "selected" : ""} onClick={() => setPhase(2)}>3 시설 선호</button></div>
      <div className="journey-form">{phase === 0 && <div className="journey-fields"><label>여정<select value={s.direction} onChange={e => update({ direction: e.target.value as Situation["direction"] })}><option value="departure">출발</option><option value="arrival">도착</option><option value="transfer">환승</option></select></label><label>현재 위치<select value={s.location} onChange={e => update({ location: e.target.value as Situation["location"] })}>{Object.entries(locationLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>운항 상태<select value={s.status} onChange={e => manualUpdate({ status: e.target.value as Situation["status"] })}><option value="normal">정상</option><option value="delayed">지연</option><option value="cancelled">결항</option></select></label><label>예상 지연 시간 (분)<input type="number" min="0" value={s.delayMinutes} onChange={e => manualUpdate({ delayMinutes: Math.max(0, Number(e.target.value) || 0) })} /></label></div>}
        {phase === 1 && <div className="journey-fields check-fields">{checkbox("baggage", "위탁수하물 있음")}{checkbox("connection", "환승편 있음")}{checkbox("hotel", "숙소 예약 있음")}{checkbox("transport", "공항 교통편 예약 있음")}{checkbox("insurance", "여행자보험 가입")}{checkbox("child", "어린이 동반")}{checkbox("senior", "고령자 동반")}{checkbox("pregnant", "임산부")}{checkbox("accessibility", "이동지원 필요")}</div>}
        {phase === 2 && <div className="journey-fields"><label>선호 활동<select value={s.preference} onChange={e => update({ preference: e.target.value as Situation["preference"] })}>{Object.entries(preferenceLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>{checkbox("freeFirst", "무료 시설 우선")}<label>시설까지 이동시간 (직접 확인한 분)<input type="number" min="0" placeholder="확인 필요" value={s.outboundMinutes ?? ""} onChange={e => update({ outboundMinutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></label><label>시설에서 탑승구 복귀시간 (분)<input type="number" min="0" placeholder="확인 필요" value={s.returnMinutes ?? ""} onChange={e => update({ returnMinutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></label><p className="section-copy">탑승 마감 전 여유 {s.cutoffMinutes}분과 추가 안전 여유 {s.safetyMinutes}분을 적용합니다. 항공사별 마감시각을 확인하세요.</p></div>}
        {phase < 2 ? <button className="journey-next" type="button" onClick={() => setPhase(phase + 1)}>다음 단계</button> : <button className="journey-next" type="button" onClick={complete}><CheckCircle2 size={17} /> 완료 · 맞춤 안내 보기</button>}
        {completion && <p className="completion-note" role="status">{completion}</p>}
      </div></div>
    <div className="journey-columns" id="journey-results">
      <section className="guide-section journey-actions-panel">
        <div className="guide-head"><span className="guide-icon"><CheckCircle2 size={21} /></span><div><p className="section-kicker">Personal checklist</p><h2>2. 맞춤 행동 체크리스트</h2></div></div>
        <p>{active.length}개 항목 · 완료 {active.filter(item => progress[item.id]).length}개 · 이전 단계 완료 기록도 보관</p>
        {s.location === "onboard" && <p className="journey-alert">기내에서는 승무원 안내를 우선하세요. 인터넷 연결 후 운항정보와 환승편을 다시 확인하세요.</p>}
        <div className="action-view-bar">
          <span className="action-position" aria-live="polite">{showAllActions ? `전체 ${active.length}개 항목` : active.length ? `${currentActionIndex + 1} / ${active.length}` : "표시할 항목 없음"}</span>
          <button type="button" className="action-view-toggle" onClick={() => setShowAllActions(value => !value)} aria-pressed={showAllActions}>
            <List size={16} aria-hidden="true" /> {showAllActions ? "하나씩 보기" : "전체보기"}
          </button>
        </div>
        <div className="action-checklist">
          {visibleActions.map(item => <div key={item.id} className="action-check">
            <label><input type="checkbox" checked={!!progress[item.id]} onChange={e => setSaved(prev => ({ ...prev, progress: { ...prev.progress, [item.id]: e.target.checked } }))} /><span>{item.title}{item.needsConnection && !online && <small> · 인터넷 연결 후 확인</small>}</span></label>
            <p><strong>어디서</strong> {item.where}</p>
            <p><strong>어떻게</strong> {item.how}</p>
            {liveDetail(item, flight, saved.previousGate) && <p className="action-live"><span>{liveDetail(item, flight, saved.previousGate)}</span>{(item.id === "changed-time" || item.id === "check-time") && flight && <span className="action-live-updated">조회시간 {format(flight.lastUpdatedAt)}</span>}</p>}
            {item.officialUrl && (online ? <a className="action-official" href={item.officialUrl} target="_blank" rel="noreferrer">공식 안내 열기 <ExternalLink size={14} /></a> : <p>공식 링크는 인터넷 연결 후 이용할 수 있습니다.</p>)}
            <input aria-label={`${item.title} 메모`} placeholder="메모 추가" value={saved.notes[item.id] ?? ""} onChange={e => setSaved(prev => ({ ...prev, notes: { ...prev.notes, [item.id]: e.target.value } }))} />
          </div>)}
          {active.length === 0 && <p className="action-empty">현재 상황에 맞는 행동 항목이 없습니다. 위치와 상태를 다시 확인해 주세요.</p>}
        </div>
        {!showAllActions && active.length > 0 && <nav className="action-pager" aria-label="맞춤 행동 항목 이동">
          <button type="button" onClick={() => setCurrentActionId(active[currentActionIndex - 1].id)} disabled={currentActionIndex === 0}><ChevronLeft size={17} aria-hidden="true" /> 이전</button>
          <button type="button" onClick={() => setCurrentActionId(active[currentActionIndex + 1].id)} disabled={currentActionIndex === active.length - 1}>다음 <ChevronRight size={17} aria-hidden="true" /></button>
        </nav>}
        <details><summary>이전 항목과 완료 기록</summary>{checklistCatalog.filter(item => !active.some(a => a.id === item.id) && saved.progress[item.id]).map(item => <p key={item.id}>{item.title} · 완료</p>)}</details>
      </section>
      <section className="guide-section journey-facilities-panel"><div className="guide-head"><span className="guide-icon"><MapPin size={21} /></span><div><p className="section-kicker">Airport facilities</p><h2>{s.location === "onboard" ? "3. 착륙 후 시설 미리보기" : "3. 지연 중 시설 추천"}</h2></div></div>{s.location === "onboard" ? <p>기내에서는 시설 방문이 불가능합니다. 착륙 후 터미널과 도착·환승 구역을 확인하세요. 아래 시설은 참고 정보입니다.</p> : <p>현재 터미널·이동 가능 구역·운영시간을 기준으로 추천합니다. 시설 정보는 월 1회 갱신되며 운영시간이 바뀔 수 있습니다.</p>}
        {arrivalPreview.map(f => <article className="facility-card" key={f.id}><strong>{f.name}</strong><p>{f.category} · {terminalLabels[f.terminal] ?? f.terminal} {f.floor} · {zoneLabels[f.zone]}</p><p>운영시간 {f.hours} · 위치 {f.location} · 시설정보 조회 {format(f.updatedAt)}</p></article>)}
        {s.location !== "onboard" && visits.length > 0 && <div className="journey-alert">출발 {s.cutoffMinutes}분 전까지 탑승구로 이동하세요. 이동시간을 입력하지 않았다면 시설까지의 동선과 복귀시간을 직접 확인하고, 시간이 부족하면 방문하지 마세요.</div>}
        {s.location !== "onboard" && visits.length === 0 && flight?.direction === "departure" && s.status !== "cancelled" && (until === null || until <= s.cutoffMinutes + 15 || safe !== null && safe < 15) && <div className="journey-alert">출발이 임박했거나 복귀 가능 시간을 확인할 수 없습니다. 시설 방문보다 탑승구 대기를 권합니다.</div>}
        {visits.map(({ facility: f, reason }, index) => <article className="facility-card" key={f.id}><strong>{["같은 구역의 추천 후보", "다른 종류의 시설", "선호에 맞는 시설"][index]} · {f.name}</strong><p>{f.category} · {terminalLabels[f.terminal] ?? f.terminal} {f.floor} · {zoneLabels[f.zone]}</p><p>운영시간 {f.hours} · 무료·유료 여부 확인 필요 · 이동시간: {s.outboundMinutes === null ? "확인 필요" : `직접 입력한 예상 ${s.outboundMinutes}분`}</p><p>추천 이유: {reason}. 위치: {f.location}</p><p>탑승구 복귀 권장: {s.returnMinutes === null ? `출발 ${s.cutoffMinutes}분 전까지 탑승구로 이동 (복귀시간 확인 필요)` : `시설에서 출발 ${s.cutoffMinutes + s.safetyMinutes + s.returnMinutes}분 전까지 이동 시작`} · 시설정보 조회 {format(f.updatedAt)}</p></article>)}
        {visits.length === 0 && flight?.direction === "departure" && s.status !== "cancelled" && (safe === null ? until !== null && until > s.cutoffMinutes + 15 : safe >= 15) && s.location !== "onboard" && <p>{facilityEmptyReason(saved.facilities, flight, s)}</p>}
        <div className="facility-map-panel"><MapPin size={19} /><div><strong>공항 공식 지도에서 위치 확인</strong><p>시설의 터미널·층·구역·위치 설명을 지도와 대조하세요. 시설 API는 정확한 좌표와 이동시간을 제공하지 않습니다.</p>{online ? <a href={AIRPORT_MAP} target="_blank" rel="noreferrer">인천공항 공식 지도 열기 <ExternalLink size={14} /></a> : <small>공식 지도는 인터넷 연결 후 열 수 있습니다.</small>}</div></div>
        <p className="section-copy">정확한 거리·혼잡도·가격·입장 조건은 API에서 제공되지 않습니다. 시설 방문 전 공식 안내를 확인하세요.</p><button className="journey-next" type="button" onClick={() => void sync()} disabled={!online || syncing || refreshingFlight}><RefreshCw size={16} /> {syncing || refreshingFlight ? "동기화 중" : "최신 정보 동기화"}</button><p>시설 마지막 동기화 {format(saved.facilitySyncedAt)} · 운항 마지막 동기화 {format(saved.syncedAt)}</p>{!online && <p>인터넷 연결이 없어 동기화할 수 없습니다.</p>}{error && <div className="status-message error" role="alert"><AlertTriangle size={18} /><p>{error} 다시 시도할 수 있습니다.</p></div>}
      </section></div>
  </section>;
}
