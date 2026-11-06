import type { ResponseStage } from "./types";

const DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/;

export const TERMINAL_LABELS: Record<string, string> = {
  P01: "제1터미널",
  P02: "탑승동",
  P03: "제2터미널",
};

export function normalizeFlightId(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidFlightId(value: string): boolean {
  return /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(normalizeFlightId(value));
}

function parseApiDatetime(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(DATE_TIME_PATTERN);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parts = [year, month, day, hour, minute].map(Number);
  const [y, m, d, h, min] = parts;
  if (m < 1 || m > 12 || h > 23 || min > 59) return null;

  const timestamp = Date.UTC(y, m - 1, d, h, min);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== min
  ) {
    return null;
  }
  return timestamp;
}

export function calculateDelayMinutes(
  scheduled?: string | null,
  estimated?: string | null,
): number | null {
  const scheduleTime = parseApiDatetime(scheduled);
  const estimatedTime = parseApiDatetime(estimated);
  if (scheduleTime === null || estimatedTime === null) return null;
  return Math.max(0, Math.round((estimatedTime - scheduleTime) / 60_000));
}

export function classifyResponseStage(
  delayMinutes: number | null,
  status: string,
): ResponseStage {
  if (status.includes("결항")) return "cancelled";
  if (delayMinutes === null) return "unknown";
  if (delayMinutes < 120) return "check";
  if (delayMinutes <= 240) return "index-insurance";
  if (delayMinutes <= 720) return "expense-insurance";
  return "long-delay";
}

export function terminalLabel(code?: string | null): string {
  if (!code || code === "-") return "확인 필요";
  return TERMINAL_LABELS[code] ?? "확인 필요";
}

export function formatApiDatetime(value?: string | null): string {
  const match = value?.match(DATE_TIME_PATTERN);
  if (!match || parseApiDatetime(value) === null) return "확인 필요";
  const [, year, month, day, hour, minute] = match;
  return `${year}.${month}.${day} ${hour}:${minute}`;
}
