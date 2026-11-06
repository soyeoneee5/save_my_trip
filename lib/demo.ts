import { calculateDelayMinutes, classifyResponseStage, terminalLabel } from "./flight";
import type { FlightDirection, FlightRecord } from "./types";

export type DemoScenario = "normal" | "delay-3h" | "delay-6h" | "delay-13h" | "cancelled";

const SCENARIOS: Record<DemoScenario, { label: string; minutes: number; status: string }> = {
  normal: { label: "정상 운항", minutes: 0, status: "탑승구 안내" },
  "delay-3h": { label: "3시간 지연", minutes: 180, status: "지연" },
  "delay-6h": { label: "6시간 지연", minutes: 360, status: "지연" },
  "delay-13h": { label: "13시간 지연", minutes: 780, status: "지연" },
  cancelled: { label: "결항", minutes: 0, status: "결항" },
};

export const DEMO_OPTIONS = Object.entries(SCENARIOS).map(([value, item]) => ({
  value: value as DemoScenario,
  label: item.label,
}));

export function createDemoFlight(
  scenario: DemoScenario,
  direction: FlightDirection,
  now = new Date(),
): FlightRecord {
  const item = SCENARIOS[scenario];
  const seoulStamp = (date: Date) => new Date(date.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 16).replace(/[-T:]/g, "");
  const scheduledAt = new Date(now.getTime() + 90 * 60_000);
  const scheduled = seoulStamp(scheduledAt);
  const estimated = seoulStamp(new Date(scheduledAt.getTime() + item.minutes * 60_000));
  const delayMinutes = calculateDelayMinutes(scheduled, estimated);

  return {
    id: `demo-${scenario}`,
    flightId: "KE901",
    airline: "대한항공",
    airport: direction === "departure" ? "파리/샤를드골" : "파리/샤를드골",
    airportCode: "CDG",
    scheduleDatetime: scheduled,
    estimatedDatetime: scenario === "cancelled" ? null : estimated,
    delayMinutes: scenario === "cancelled" ? null : delayMinutes,
    status: item.status,
    terminal: terminalLabel("P02"),
    terminalCode: "P02",
    gate: scenario === "cancelled" ? "확인 필요" : "231",
    checkinCounter: direction === "departure" ? "A01-A12" : "해당 없음",
    direction,
    lastUpdatedAt: new Date().toISOString(),
    isSimulation: true,
    stage: classifyResponseStage(
      scenario === "cancelled" ? null : delayMinutes,
      item.status,
    ),
  };
}
