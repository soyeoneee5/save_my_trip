export type StatusTone = "blue" | "yellow" | "orange" | "red";

export function statusTone(status: string, delayMinutes: number | null): StatusTone {
  if (/결항|cancel/i.test(status)) return "red";
  if (delayMinutes !== null && delayMinutes >= 240) return "orange";
  if (delayMinutes !== null && delayMinutes >= 120) return "yellow";
  return "blue";
}

export const statusToneLabel: Record<StatusTone, string> = {
  blue: "운항정보 확인",
  yellow: "2시간 이상 지연",
  orange: "4시간 이상 지연",
  red: "결항",
};
