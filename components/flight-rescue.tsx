"use client";

import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Info,
  LoaderCircle,
  Plane,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoFlight, DEMO_OPTIONS, type DemoScenario } from "@/lib/demo";
import { JourneyPanel } from "@/components/journey-panel";
import { classifyResponseStage, formatApiDatetime, normalizeFlightId } from "@/lib/flight";
import { consumerDisputeRate, evidenceCatalog, evidenceForSituation } from "@/lib/evidence";
import { defaultSituation, flightStatus, immediateItems, type Situation } from "@/lib/journey";
import { statusTone, statusToneLabel } from "@/lib/status";
import { isTrackableFlight, shouldRefreshFlight, FLIGHT_REFRESH_INTERVAL_MS } from "@/lib/refresh";
import type { FlightDirection, FlightRecord, FlightSearchResponse, ResponseStage } from "@/lib/types";

const STAGE_CONTENT: Record<
  ResponseStage,
  { label: string; title: string }
> = {
  check: {
    label: "운항정보 확인 단계",
    title: "변경 정보부터 차분히 확인하세요",
  },
  "index-insurance": {
    label: "보상 가능성 및 지수형 보험 확인 단계",
    title: "지연 증빙을 확보하고 보상 조건을 확인하세요",
  },
  "expense-insurance": {
    label: "항공사 보상 및 실비형 보험 확인 단계",
    title: "현장 지원을 요청하고 실제 지출을 기록하세요",
  },
  "long-delay": {
    label: "장시간 지연 대응 단계",
    title: "대체 일정과 숙박 지원을 함께 검토하세요",
  },
  cancelled: {
    label: "대체편·환불·보험 확인 단계",
    title: "대체편과 환불 조건을 우선 확인하세요",
  },
  unknown: {
    label: "운항정보 확인 단계",
    title: "변경시간을 항공사에서 확인해 주세요",
  },
};

function dateRange() {
  const todayText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const base = new Date(`${todayText}T00:00:00Z`);
  const offset = (days: number) => {
    const value = new Date(base);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  return { today: todayText, min: offset(-3), max: offset(6) };
}

function delayText(minutes: number | null) {
  if (minutes === null) return "확인 필요";
  if (minutes === 0) return "지연 없음";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}시간` : "", rest ? `${rest}분` : ""].filter(Boolean).join(" ");
}

function FlightCard({ flight }: { flight: FlightRecord }) {
  const departure = flight.direction === "departure";
  const tone = statusTone(flight.status, flight.delayMinutes);
  return (
    <article className="result-card" aria-label={`${flight.flightId} 운항 결과`}>
      {flight.isSimulation && (
        <div className="simulation-banner"><Sparkles size={15} aria-hidden="true" /> 시뮬레이션 데이터 · 실제 운항정보가 아닙니다</div>
      )}
      <header className="flight-heading">
        <div>
          <h3 className="flight-id">{flight.flightId}</h3>
          <p className="airline">{flight.airline}</p>
        </div>
        <span className={`status-badge ${tone}`}>
          {tone === "red" ? <Siren size={15} /> : <BadgeCheck size={15} />}
          {statusToneLabel[tone]} · {flight.status}
        </span>
      </header>

      <div className="route-line">
        <div className="route-end">
          <p className="airport-code">{departure ? "ICN" : flight.airportCode || "—"}</p>
          <p className="airport-name">{departure ? "인천" : flight.airport}</p>
        </div>
        <Plane className="route-icon" size={23} aria-label={departure ? "출발" : "도착"} />
        <div className="route-end">
          <p className="airport-code">{departure ? flight.airportCode || "—" : "ICN"}</p>
          <p className="airport-name">{departure ? flight.airport : "인천"}</p>
        </div>
      </div>

      <dl className="detail-grid">
        <div className="detail"><dt>예정시간</dt><dd>{formatApiDatetime(flight.scheduleDatetime)}</dd></div>
        <div className="detail"><dt>변경시간</dt><dd>{formatApiDatetime(flight.estimatedDatetime)}</dd></div>
        <div className="detail"><dt>계산된 지연시간</dt><dd className={flight.delayMinutes && flight.delayMinutes >= 120 ? "important" : ""}>{delayText(flight.delayMinutes)}</dd></div>
        <div className="detail"><dt>터미널</dt><dd>{flight.terminal}</dd></div>
        <div className="detail"><dt>게이트</dt><dd>{flight.gate}</dd></div>
        <div className="detail"><dt>체크인 카운터</dt><dd>{flight.checkinCounter}</dd></div>
        <div className="detail"><dt>운항 상태</dt><dd>{flight.status}</dd></div>
        <div className="detail"><dt>최종 조회시간</dt><dd>{new Date(flight.lastUpdatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</dd></div>
      </dl>
      <p className="result-footnote">출발 지연시간은 예정시간과 변경시간의 단순 차이입니다. 실제 목적지 도착 지연시간이나 법적 보상 확정 기준이 아닙니다.</p>
    </article>
  );
}

export function FlightRescue() {
  const range = useMemo(() => dateRange(), []);
  const [flightId, setFlightId] = useState("");
  const [date, setDate] = useState(range.today);
  const [direction, setDirection] = useState<FlightDirection>("departure");
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("delay-3h");
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [evidenceSituation, setEvidenceSituation] = useState<Situation | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingStopped, setTrackingStopped] = useState(false);
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    try {
      const saved = localStorage.getItem("flight-rescue-evidence-v1");
      if (saved) {
        const restored = JSON.parse(saved) as string[];
        frame = requestAnimationFrame(() => setChecked(restored.map(value => evidenceCatalog.find(item => item.title === value)?.id ?? value)));
      }
    } catch {
      // 저장 데이터가 손상된 경우 빈 체크리스트로 시작합니다.
    }
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("flight-rescue-last-flight-v1");
      if (cached) {
        const parsed = JSON.parse(cached) as FlightRecord;
        if (!parsed.isSimulation) {
          const frame = requestAnimationFrame(() => {
            setFlights(current => current.length ? current : [parsed]);
            setLastSuccessAt(parsed.lastUpdatedAt);
          });
          return () => cancelAnimationFrame(frame);
        }
      }
    } catch { /* 손상된 로컬 캐시는 무시합니다. */ }
  }, []);

  const selected = flights[0] ?? null;
  const stage = STAGE_CONTENT[selected?.stage ?? "check"];
  const currentSituation = useMemo(() => evidenceSituation ?? (selected ? { ...defaultSituation, status: flightStatus(selected), delayMinutes: selected.delayMinutes ?? 0 } : defaultSituation), [evidenceSituation, selected]);
  const actionStage = STAGE_CONTENT[classifyResponseStage(currentSituation.delayMinutes, currentSituation.status === "cancelled" ? "결항" : "지연")];
  const actionItems = useMemo(() => immediateItems(currentSituation), [currentSituation]);
  const evidenceItems = useMemo(() => evidenceForSituation(currentSituation), [currentSituation]);

  const refreshFlight = useCallback(async (force = false) => {
    if (!selected || !isTrackableFlight(selected) || trackingStopped || inFlightRef.current || !navigator.onLine || document.visibilityState !== "visible") return;
    if (!force && Date.now() - lastAttemptRef.current < FLIGHT_REFRESH_INTERVAL_MS) return;
    inFlightRef.current = true;
    lastAttemptRef.current = Date.now();
    setRefreshing(true);
    try {
      const raw = selected.scheduleDatetime.slice(0, 8);
      const searchDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const query = new URLSearchParams({ flightId: selected.flightId, date: searchDate, direction: selected.direction });
      const response = await fetch(`/api/flights?${query}`, { cache: "no-store" });
      const payload = (await response.json()) as FlightSearchResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message || "운항정보를 새로 확인하지 못했습니다.");
      const latest = payload.flights.find(item => item.flightId === selected.flightId) ?? payload.flights[0];
      if (!latest) throw new Error("새 조회에서 항공편을 찾지 못했습니다. 저장된 정보를 표시합니다.");
      setFlights([latest]);
      setLastSuccessAt(new Date().toISOString());
      setRefreshError(null);
      localStorage.setItem("flight-rescue-last-flight-v1", JSON.stringify(latest));
    } catch (caught) {
      setRefreshError(caught instanceof Error ? caught.message : "운항정보 갱신에 실패했습니다.");
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [selected, trackingStopped]);

  useEffect(() => {
    if (!isTrackableFlight(selected) || trackingStopped) return;
    const tick = () => {
      if (shouldRefreshFlight({ flight: selected, online: navigator.onLine, visible: document.visibilityState === "visible", stopped: trackingStopped, inFlight: inFlightRef.current, lastAttempt: lastAttemptRef.current, now: Date.now() })) void refreshFlight();
    };
    tick();
    const timer = window.setInterval(tick, FLIGHT_REFRESH_INTERVAL_MS);
    const online = () => { lastAttemptRef.current = 0; tick(); };
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", online);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); window.removeEventListener("online", online); };
  }, [selected, trackingStopped, refreshFlight]);

  function toggleCheck(item: string) {
    setChecked((current) => {
      const next = current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item];
      localStorage.setItem("flight-rescue-evidence-v1", JSON.stringify(next));
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEmptyMessage(null);
    setFlights([]);
    setTrackingStopped(false);
    const normalized = normalizeFlightId(flightId);
    setFlightId(normalized);
    if (!normalized) {
      setError("항공편명을 입력해 주세요. 예: KE901");
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({ flightId: normalized, date, direction });
      const response = await fetch(`/api/flights?${query}`);
      const payload = (await response.json()) as FlightSearchResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message || "운항정보를 불러오지 못했습니다.");
      if (payload.flights.length === 0) {
        setEmptyMessage(
          payload.meta.exclusionReason === "cargo-or-domestic-only"
            ? "검색 결과가 화물기 또는 국내선뿐이라 표시하지 않았습니다. 국제선 여객기 편명을 확인해 주세요."
            : "조건에 맞는 항공편을 찾지 못했습니다. 편명, 날짜, 출발·도착 선택을 확인해 주세요.",
        );
      } else {
        setFlights(payload.flights);
        lastAttemptRef.current = Date.now();
        setLastSuccessAt(new Date().toISOString());
        setRefreshError(null);
        localStorage.setItem("flight-rescue-last-flight-v1", JSON.stringify(payload.flights[0]));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function runDemo() {
    setError(null);
    setEmptyMessage(null);
    setFlights([createDemoFlight(demoScenario, direction)]);
    setTrackingStopped(true);
    requestAnimationFrame(() => document.querySelector("#flight-results")?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <main className="shell" id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <nav className="hero-nav" aria-label="주요 메뉴">
            <a className="brand" href="#top"><span className="brand-mark"><Plane size={20} aria-hidden="true" /></span> Save my Trip<span className="brand-dot">.</span></a>
            <div className="hero-nav-links"><a href="#search-title">항공편 검색</a><a href="#journey-title">맞춤 대응</a><a href="#official-title">공식 정보</a></div>
            <a className="hero-nav-cta" href="#search-title">운항 조회 <ArrowRight size={16} aria-hidden="true" /></a>
          </nav>
          <div className="hero-grid">
            <div className="hero-message">
              <p className="eyebrow">INCHEON INTERNATIONAL FLIGHT CARE</p>
              <h1 id="hero-title">지연된 순간,<br /><span>다음 행동은 <br className="mobile-break" />선명하게.</span></h1>
              <p className="hero-copy">인천공항 국제선 여객편의 운항정보를 확인하고, 지연·결항 상황에서 지금 준비할 행동과 증빙을 한곳에서 살펴보세요.</p>
              <div className="hero-actions"><a className="hero-primary" href="#search-title">내 항공편 찾기 <ArrowRight size={17} aria-hidden="true" /></a><a className="hero-secondary" href="#journey-title">대응 가이드 보기 <ChevronRight size={17} aria-hidden="true" /></a></div>
              <div className="hero-pills" aria-label="서비스 특징">
                <span className="hero-pill"><CheckCircle2 size={14} aria-hidden="true" /> 국제선 여객기 전용</span>
                <span className="hero-pill"><CheckCircle2 size={14} aria-hidden="true" /> 공식 API 운항정보</span>
                <span className="hero-pill"><CheckCircle2 size={14} aria-hidden="true" /> 보상·보험 확인 가이드</span>
              </div>
            </div>
            <div className="hero-visual" aria-label="서비스 이용 흐름">
              <div className="hero-visual-top"><span className="hero-visual-kicker">FLIGHT CARE WORKFLOW</span><span className="hero-visual-live"><span /> 3 STEPS</span></div>
              <h2>공항에서 필요한 판단을<br />더 간단하게.</h2>
              <div className="hero-flow-step"><span className="flow-icon"><Search size={18} aria-hidden="true" /></span><div><small>01 / FLIGHT</small><strong>운항정보 확인</strong><p>예정·변경시간과 탑승구 확인</p></div><ArrowRight size={17} aria-hidden="true" /></div>
              <div className="hero-flow-step"><span className="flow-icon"><ClipboardCheck size={18} aria-hidden="true" /></span><div><small>02 / ACTION</small><strong>지금 할 일 확인</strong><p>내 위치와 상황에 맞는 행동 정리</p></div><ArrowRight size={17} aria-hidden="true" /></div>
              <div className="hero-flow-step"><span className="flow-icon"><FileCheck2 size={18} aria-hidden="true" /></span><div><small>03 / PROOF</small><strong>증빙과 지원 준비</strong><p>서류·보험·항공사 확인 사항 보관</p></div><CheckCircle2 size={17} aria-hidden="true" /></div>
              <div className="hero-visual-foot"><ShieldCheck size={16} aria-hidden="true" /> 실제 운항정보는 조회 시각과 출처를 함께 표시합니다.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="content">
        <section className="search-card" aria-labelledby="search-title">
          <p className="section-kicker">Flight search</p>
          <h2 className="section-title" id="search-title">내 항공편 찾기</h2>
          <p className="section-copy">조회일 기준 3일 전부터 6일 후까지 검색할 수 있습니다.</p>
          <form className="form-grid" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="flight-id">항공편명</label>
              <input id="flight-id" className="input" value={flightId} onChange={(event) => setFlightId(event.target.value)} placeholder="예: KE 901" autoComplete="off" inputMode="text" />
            </div>
            <div className="field">
              <label htmlFor="flight-date">출발 날짜</label>
              <input id="flight-date" className="input" type="date" min={range.min} max={range.max} value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label">운항 구분</legend>
              <div className="segmented">
                <button className={`segment ${direction === "departure" ? "active" : ""}`} type="button" onClick={() => setDirection("departure")} aria-pressed={direction === "departure"}>출발</button>
                <button className={`segment ${direction === "arrival" ? "active" : ""}`} type="button" onClick={() => setDirection("arrival")} aria-pressed={direction === "arrival"}>도착</button>
              </div>
            </fieldset>
            <button className="search-button" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spinner" size={19} aria-hidden="true" /> : <Search size={19} aria-hidden="true" />}
              {loading ? "조회 중" : "운항 조회"}
            </button>
          </form>
          <div className="demo-row">
            <div>
              <label className="field-label" htmlFor="demo-scenario">발표용 데모</label>
              <p className="demo-note">실제 운항정보와 명확히 구분된 시뮬레이션을 실행합니다.</p>
            </div>
            <select id="demo-scenario" className="input" value={demoScenario} onChange={(event) => setDemoScenario(event.target.value as DemoScenario)}>
              {DEMO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="demo-button" type="button" onClick={runDemo}>데모 실행</button>
          </div>
          <div aria-live="polite" aria-atomic="true">
            {loading && <div className="status-message empty" role="status"><LoaderCircle className="spinner" size={20} aria-hidden="true" /><div><h3>운항정보를 조회하고 있습니다</h3><p>인천공항에서 최신 정보를 불러오는 중입니다.</p></div></div>}
            {error && <div className="status-message error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><h3>조회하지 못했습니다</h3><p>{error}</p></div></div>}
            {emptyMessage && <div className="status-message empty"><Info size={20} aria-hidden="true" /><div><h3>검색 결과가 없습니다</h3><p>{emptyMessage}</p></div></div>}
          </div>
        </section>

        {flights.length > 0 && (
          <section className="results" id="flight-results" aria-labelledby="results-title">
            <p className="section-kicker">Live result</p>
            <h2 className="section-title" id="results-title">운항 결과</h2>
            <div className="results-layout">
              <div>{flights.map((flight) => <FlightCard key={flight.id} flight={flight} />)}</div>
              <div className="guide-stack">
                <section className={`guide-section status-panel ${selected ? statusTone(selected.status, selected.delayMinutes) : "blue"}`} aria-labelledby="status-title">
                  <div className="guide-head"><span className="guide-icon"><Siren size={21} /></span><div><p className="section-kicker">현재 상태</p><h2 id="status-title">{stage.label}</h2></div></div>
                  <p><strong>{selected ? statusToneLabel[statusTone(selected.status, selected.delayMinutes)] : "운항정보 확인"}</strong> · {selected?.stage === "cancelled" ? "결항은 지연시간과 관계없이 결항 대응 단계로 안내합니다." : `계산된 지연시간 ${delayText(selected?.delayMinutes ?? null)} 기준입니다.`}</p>
                  {selected && !selected.isSimulation && <div className="refresh-controls"><button type="button" onClick={() => void refreshFlight(true)} disabled={refreshing || trackingStopped || !isTrackableFlight(selected)}><LoaderCircle size={15} className={refreshing ? "spinner" : ""} />{refreshing ? "갱신 중" : "운항정보 새로고침"}</button><button type="button" onClick={() => setTrackingStopped(value => !value)} disabled={!isTrackableFlight(selected)}>{trackingStopped ? "자동 갱신 재개" : "자동 갱신 중지"}</button></div>}
                  {selected && !selected.isSimulation && <p className="refresh-meta">마지막 성공 {lastSuccessAt ? new Date(lastSuccessAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음"} · {trackingStopped ? "자동 갱신 중지됨" : isTrackableFlight(selected) ? "5분 간격 확인" : "자동 갱신 종료"}</p>}
                  {refreshError && <p className="refresh-error" role="alert">갱신 실패: {refreshError} 저장된 마지막 정보를 표시합니다. 다시 시도할 수 있습니다.</p>}
                </section>
                <section className="guide-section" aria-labelledby="action-title">
                  <div className="guide-head"><span className="guide-icon"><ClipboardCheck size={21} /></span><div><p className="section-kicker">Action now</p><h2 id="action-title">지금 해야 할 행동</h2></div></div>
                  <h3>{actionStage.title}</h3>
                  <ol className="action-list">{actionItems.map((item, index) => <li key={item.id}><span className="number">{index + 1}</span><span>{item.title}</span></li>)}</ol>
                </section>
              </div>
            </div>
          </section>
        )}

        <JourneyPanel liveFlight={selected} onSituationChange={setEvidenceSituation} onRefreshFlight={() => refreshFlight(true)} refreshingFlight={refreshing} />
        <div className="guide-stack" style={{ marginTop: 18 }}>
          <section className="guide-section" aria-labelledby="compensation-title">
            <div className="guide-head"><span className="guide-icon"><BadgeCheck size={21} /></span><div><p className="section-kicker">Airline</p><h2 id="compensation-title">항공사 보상 확인</h2></div></div>
            {currentSituation.status !== "cancelled" && currentSituation.delayMinutes < 120 ? <><h3 className="compensation-empty-title">현재 단계에서 준비할 보상 서류는 없어요</h3><p>현재 지연시간만으로 일반적인 보상 대상이라고 안내하기 어렵습니다. 항공사 정책, 지연 원인, 노선, 출발 국가, 여행자보험 약관에 따라 달라질 수 있어요.</p><p>지연시간이 늘어나면 필요한 서류와 대응 항목을 다시 안내해 드릴게요.</p></> : <p>보상 가능성이 있습니다. 항공사의 지연 사유와 귀책 여부를 먼저 확인하세요.</p>}
            {consumerDisputeRate(currentSituation) && <div className="compensation-rate">한국 국제여객 소비자분쟁해결기준 참고 · {consumerDisputeRate(currentSituation)}</div>}
            <div className="notice"><Info size={17} aria-hidden="true" /><span>이 기준은 자동 지급되는 확정 보상금이 아니라 분쟁 해결을 위한 기준입니다. 기상, 공항 사정, 안전운항 조치 등으로 보상이 제한될 수 있습니다.</span></div>
          </section>

          <section className="guide-section" aria-labelledby="insurance-title">
            <div className="guide-head"><span className="guide-icon"><ShieldCheck size={21} /></span><div><p className="section-kicker">Insurance</p><h2 id="insurance-title">여행자보험 확인</h2></div></div>
            <p>가입한 보험 특약과 항공사 확인이 필요합니다.</p>
            <ul className="plain-list">
              <li>일부 지수형 특약: 2시간 이상부터 보상 가능성 확인</li>
              <li>실손형 특약: 일부 상품은 2시간 이상부터 실제 지출 비용을 청구할 수 있고, 다른 상품은 4시간 등 조건이 다릅니다. 가입 특약의 보장 시간·지출 항목·면책 조건을 확인하세요.</li>
              <li>결항: 출발 예정시각부터 4시간 이내 대체편 미제공 조건 등을 확인</li>
              <li>보험사와 상품마다 조건이 다르므로 약관 확인 필요</li>
            </ul>
          </section>

          <section className="guide-section full" aria-labelledby="checklist-title">
            <div className="guide-head"><span className="guide-icon"><FileCheck2 size={21} /></span><div><p className="section-kicker">Evidence</p><h2 id="checklist-title">증빙서류 체크리스트</h2></div></div>
            <p>체크 상태는 이 브라우저에만 임시 저장되며 서버로 전송되지 않습니다.</p>
            <p className="check-progress"><CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> {evidenceItems.filter(item => checked.includes(item.id)).length} / {evidenceItems.length} 준비 완료</p>
            <div className="checklist">
              {evidenceItems.map((item) => (
                <label className={`check-item ${checked.includes(item.id) ? "checked" : ""}`} key={item.id}>
                  <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                </label>
              ))}
            </div>
            {evidenceItems.length === 0 && <div className="evidence-empty"><Info size={18} /><span>현재 지연 구간에서 준비할 보상 증빙은 없습니다. 운항정보와 항공사 안내를 계속 확인하세요.</span></div>}
            {currentSituation.status === "cancelled" && <p className="journey-alert">결항확인서와 대체편·환불 안내를 먼저 확보하세요. 위탁수하물이 있다면 반환·연결 여부도 확인하세요.</p>}
            {currentSituation.status !== "cancelled" && currentSituation.delayMinutes >= 780 && <p className="journey-alert">장시간 지연입니다. 항공사에 대체편·환불, 식사·숙박·교통 지원 가능 여부를 우선 문의하세요.</p>}
          </section>

          <section className="guide-section full" aria-labelledby="official-title">
            <div className="guide-head"><span className="guide-icon"><CalendarDays size={21} /></span><div><p className="section-kicker">Official sources</p><h2 id="official-title">공식 정보 확인 안내</h2></div></div>
            <p>최종 운항정보와 지원 여부는 항공사·인천공항의 공식 안내를 함께 확인하세요.</p>
            <div className="official-links">
              <a className="official-link" href="https://www.airport.kr/" target="_blank" rel="noreferrer">인천국제공항 공식 홈페이지 <ExternalLink size={16} /></a>
              <a className="official-link" href="https://www.consumer.go.kr/" target="_blank" rel="noreferrer">소비자24 <ChevronRight size={17} /></a>
            </div>
            <div className="notice"><AlertCircle size={17} aria-hidden="true" /><span>Save my Trip은 정보 확인을 돕는 서비스이며 보험금 자동 판정이나 법률 자문을 제공하지 않습니다. 실제 보상은 항공사·보험사의 심사와 개별 약관에 따릅니다.</span></div>
          </section>
        </div>
      </div>

      <footer className="footer">Save my Trip · 인천공항 국제선 여객기 지연·결항 대응 가이드 <ArrowRight size={13} style={{ display: "inline", verticalAlign: "-2px" }} /></footer>
    </main>
  );
}
