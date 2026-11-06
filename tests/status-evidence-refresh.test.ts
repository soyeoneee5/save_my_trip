import { describe, expect, it } from "vitest";
import { createDemoFlight } from "@/lib/demo";
import { defaultSituation, applicableItems, mergeItemProgress } from "@/lib/journey";
import { consumerDisputeRate, evidenceBand, evidenceForSituation } from "@/lib/evidence";
import { statusTone } from "@/lib/status";
import { FLIGHT_REFRESH_INTERVAL_MS, shouldRefreshFlight } from "@/lib/refresh";

describe("지연 상태 색상과 증빙 경계", () => {
  it.each([[0, "blue"], [20, "blue"], [45, "blue"], [119, "blue"], [120, "yellow"], [239, "yellow"], [240, "orange"], [780, "orange"]] as const)("%i분의 상태는 %s", (minutes, tone) => {
    expect(statusTone("지연", minutes)).toBe(tone);
  });
  it("결항은 지연시간보다 우선한다", () => expect(statusTone("결항", 0)).toBe("red"));
  it.each([[119, "none"], [120, "two-hours"], [239, "two-hours"], [240, "four-hours"], [779, "four-hours"], [780, "long-delay"]] as const)("%i분 증빙 구간", (minutes, band) => {
    expect(evidenceBand("delayed", minutes)).toBe(band);
  });
  it("2시간 미만은 증빙이 없고 조건부 증빙은 선택한 상황에서만 보인다", () => {
    expect(evidenceForSituation({ ...defaultSituation, status: "delayed", delayMinutes: 119 })).toHaveLength(0);
    const four = evidenceForSituation({ ...defaultSituation, status: "delayed", delayMinutes: 240 });
    expect(four.map(item => item.id)).toEqual(expect.arrayContaining(["ticket", "time-screens", "meal-receipt"]));
    expect(four.some(item => item.id === "insurance-policy")).toBe(false);
    const long = evidenceForSituation({ ...defaultSituation, status: "delayed", delayMinutes: 780, hotel: true, transport: true, insurance: true });
    expect(long.map(item => item.id)).toEqual(expect.arrayContaining(["hotel-receipt", "transport-receipt", "insurance-policy", "rebooking-refund"]));
    const cancel = evidenceForSituation({ ...defaultSituation, status: "cancelled", baggage: true });
    expect(cancel.map(item => item.id)).toEqual(expect.arrayContaining(["delay-certificate", "rebooking-refund", "bag-tag"]));
    expect(cancel.some(item => item.id === "hotel-receipt")).toBe(false);
  });
  it("120분 실손형 보험에는 구체적인 청구 서류와 실제 지출 영수증을 표시한다",()=>{const base={...defaultSituation,status:"delayed" as const,delayMinutes:120,insurance:true,insuranceType:"expense" as const};const ids=evidenceForSituation(base).map(item=>item.id);expect(ids).toEqual(expect.arrayContaining(["ticket","boarding-pass","delay-certificate","insurance-policy","insurance-claim-form","insurance-expense-receipt"]));expect(evidenceForSituation({...base,delayMinutes:119})).toHaveLength(0);expect(evidenceForSituation({...base,insuranceType:"index"}).some(item=>item.id==="insurance-expense-receipt")).toBe(false);});
  it("보상 기준은 확정 판정 없이 경계별 검토 비율만 돌려준다", () => {
    expect(consumerDisputeRate({ ...defaultSituation, delayMinutes: 119 })).toBeNull();
    expect(consumerDisputeRate({ ...defaultSituation, delayMinutes: 120 })).toContain("10%");
    expect(consumerDisputeRate({ ...defaultSituation, delayMinutes: 240 })).toContain("10%");
    expect(consumerDisputeRate({ ...defaultSituation, delayMinutes: 241 })).toContain("20%");
    expect(consumerDisputeRate({ ...defaultSituation, delayMinutes: 721 })).toContain("30%");
  });
});

describe("체크리스트 갱신과 실시간 조회 제한", () => {
  it("2시간 지연이 결항으로 바뀌어도 완료 기록을 보존한다", () => {
    const delayed = applicableItems({ ...defaultSituation, status: "delayed", delayMinutes: 120 });
    const done = mergeItemProgress({ [delayed[0].id]: true }, delayed);
    const cancelled = applicableItems({ ...defaultSituation, status: "cancelled", delayMinutes: 120, baggage: true });
    expect(cancelled[0].id).toBe("cancel-choice");
    expect(mergeItemProgress(done, cancelled)[delayed[0].id]).toBe(true);
  });
  it("5분 간격, 오프라인, 숨김, 중복, 중지, 결항을 처리한다", () => {
    const base = { flight: { ...createDemoFlight("delay-3h", "departure"), isSimulation: false }, online: true, visible: true, stopped: false, inFlight: false, lastAttempt: 1000, now: 1000 + FLIGHT_REFRESH_INTERVAL_MS };
    expect(shouldRefreshFlight(base)).toBe(true);
    expect(shouldRefreshFlight({ ...base, now: base.now - 1 })).toBe(false);
    expect(shouldRefreshFlight({ ...base, online: false })).toBe(false);
    expect(shouldRefreshFlight({ ...base, visible: false })).toBe(false);
    expect(shouldRefreshFlight({ ...base, inFlight: true })).toBe(false);
    expect(shouldRefreshFlight({ ...base, stopped: true })).toBe(false);
    expect(shouldRefreshFlight({ ...base, flight: createDemoFlight("delay-3h", "departure") })).toBe(false);
    expect(shouldRefreshFlight({ ...base, flight: { ...base.flight, stage: "cancelled" } })).toBe(false);
  });
});
