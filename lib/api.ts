import {
  calculateDelayMinutes,
  classifyResponseStage,
  normalizeFlightId,
  terminalLabel,
} from "./flight";
import type { FlightDirection, FlightRecord } from "./types";

type UnknownRecord = Record<string, unknown>;

export class FlightApiError extends Error {
  constructor(
    public code:
      | "MISSING_KEY"
      | "AUTH_ERROR"
      | "RATE_LIMIT"
      | "UPSTREAM_ERROR"
      | "INVALID_RESPONSE",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const BASE_URL = "http://apis.data.go.kr/B551177/statusOfAllFltDeOdp";

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function first(source: UnknownRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return "";
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function extractItems(payload: unknown): UnknownRecord[] {
  const root = asRecord(payload);
  const response = asRecord(root.response ?? root);
  const body = asRecord(response.body);
  const itemsContainer = body.items;
  const rawItems = asRecord(itemsContainer).item ?? itemsContainer;
  if (Array.isArray(rawItems)) return rawItems.map(asRecord);
  if (rawItems && typeof rawItems === "object") return [asRecord(rawItems)];
  return [];
}

function getResult(payload: unknown): { code: string; message: string } {
  const root = asRecord(payload);
  const response = asRecord(root.response ?? root);
  const header = asRecord(response.header);
  return {
    code: first(header, "resultCode"),
    message: first(header, "resultMsg"),
  };
}

function passengerOnly(item: UnknownRecord): boolean {
  const value = first(item, "passengerOrCargo").toUpperCase();
  return value === "P" || value === "PASSENGER" || value === "여객기";
}

function isMasterOrStandalone(item: UnknownRecord): boolean {
  const value = first(item, "codeshare").toUpperCase();
  return value !== "SLAVE";
}

export function parseFlightResponse(
  payload: unknown,
  direction: FlightDirection,
  now = new Date(),
): { flights: FlightRecord[]; rawCount: number } {
  const items = extractItems(payload);
  const result = getResult(payload);
  if (result.code && result.code !== "00") {
    throw new FlightApiError(
      "UPSTREAM_ERROR",
      `인천공항 API 오류: ${result.message || result.code}`,
      502,
    );
  }

  const seen = new Set<string>();
  const flights: FlightRecord[] = [];

  for (const item of items) {
    if (!passengerOnly(item)) continue;
    if (first(item, "typeOfFlight").toUpperCase() !== "I") continue;
    if (!isMasterOrStandalone(item)) continue;

    const flightId = normalizeFlightId(first(item, "flightId", "flightID"));
    const scheduleDatetime = first(item, "scheduleDatetime", "scheduleDateTime");
    const masterId = normalizeFlightId(first(item, "masterFlightId"));
    const dedupeKey = `${masterId && masterId !== "-" ? masterId : flightId}:${scheduleDatetime}`;
    if (!flightId || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const estimated = first(item, "estimatedDatetime", "estimatedDateTime");
    const status = first(item, "remark") || "운항정보 확인";
    const delayMinutes = calculateDelayMinutes(scheduleDatetime, estimated);
    const terminalCode = first(item, "terminalId");

    flights.push({
      id: first(item, "fid") || dedupeKey,
      flightId,
      airline: first(item, "airline") || "항공사 확인 필요",
      airport: first(item, "airport") || "공항 확인 필요",
      airportCode: first(item, "airportCode"),
      scheduleDatetime,
      estimatedDatetime: estimated || null,
      delayMinutes,
      status,
      terminal: terminalLabel(terminalCode),
      terminalCode,
      gate: first(item, "gateNumber") || "확인 필요",
      checkinCounter:
        direction === "departure"
          ? first(item, "chkinRange", "checkinRange") || "확인 필요"
          : "해당 없음",
      direction,
      lastUpdatedAt: now.toISOString(),
      isSimulation: false,
      stage: classifyResponseStage(delayMinutes, status),
    });
  }

  return { flights, rawCount: items.length };
}

function decodeServiceKey(value: string): string {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

function mapTextError(body: string): never {
  const lower = body.toLowerCase();
  if (lower.includes("unauthorized") || lower.includes("forbidden")) {
    throw new FlightApiError(
      "AUTH_ERROR",
      "API 인증에 실패했습니다. 서비스 키와 활용 신청 상태를 확인해 주세요.",
      502,
    );
  }
  if (lower.includes("rate limit") || lower.includes("quota exceeded")) {
    throw new FlightApiError(
      "RATE_LIMIT",
      "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
      429,
    );
  }
  throw new FlightApiError(
    "UPSTREAM_ERROR",
    "인천공항 API 서버에서 정상 응답을 받지 못했습니다.",
    502,
  );
}

export async function fetchFlights(params: {
  flightId: string;
  searchDate: string;
  direction: FlightDirection;
}): Promise<{ flights: FlightRecord[]; rawCount: number }> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    throw new FlightApiError(
      "MISSING_KEY",
      "서버에 API 인증키가 설정되지 않았습니다.",
      500,
    );
  }

  const operation =
    params.direction === "departure"
      ? "getFltDeparturesDeOdp"
      : "getFltArrivalsDeOdp";
  const query = new URLSearchParams({
    serviceKey: decodeServiceKey(serviceKey),
    searchdtCode: "S",
    searchDate: params.searchDate,
    searchFrom: "0000",
    searchTo: "2400",
    flightId: params.flightId,
    passengerOrCargo: "P",
    type: "json",
    numOfRows: "100",
    pageNo: "1",
  });

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${operation}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new FlightApiError(
      "UPSTREAM_ERROR",
      "인천공항 API 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }

  const body = await response.text();
  if (!response.ok) mapTextError(body);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    mapTextError(body);
  }
  return parseFlightResponse(payload, params.direction);
}
