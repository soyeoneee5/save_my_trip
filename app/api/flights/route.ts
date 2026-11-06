import { NextRequest, NextResponse } from "next/server";
import { fetchFlights, FlightApiError } from "@/lib/api";
import { isValidFlightId, normalizeFlightId } from "@/lib/flight";
import type { FlightDirection, FlightSearchResponse } from "@/lib/types";

function seoulDateParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function getSearchDateRange(now = new Date()): { min: string; max: string } {
  const { year, month, day } = seoulDateParts(now);
  const base = new Date(Date.UTC(year, month - 1, day));
  const format = (offset: number) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  return { min: format(-3), max: format(6) };
}

export async function GET(request: NextRequest) {
  const flightId = normalizeFlightId(request.nextUrl.searchParams.get("flightId") ?? "");
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const direction = request.nextUrl.searchParams.get("direction") as FlightDirection;

  if (!isValidFlightId(flightId)) {
    return NextResponse.json(
      { code: "INVALID_FLIGHT_ID", message: "항공편명을 확인해 주세요. 예: KE901" },
      { status: 400 },
    );
  }
  if (direction !== "departure" && direction !== "arrival") {
    return NextResponse.json(
      { code: "INVALID_DIRECTION", message: "출발 또는 도착을 선택해 주세요." },
      { status: 400 },
    );
  }

  const range = getSearchDateRange();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < range.min || date > range.max) {
    return NextResponse.json(
      {
        code: "DATE_OUT_OF_RANGE",
        message: `조회 가능한 날짜는 ${range.min}부터 ${range.max}까지입니다.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchFlights({
      flightId,
      searchDate: date.replaceAll("-", ""),
      direction,
    });
    const filtered = result.flights.filter((flight) => flight.flightId === flightId);
    const body: FlightSearchResponse = {
      flights: filtered,
      meta: {
        direction,
        normalizedFlightId: flightId,
        searchedDate: date,
        filteredCount: filtered.length,
        excludedCount: result.rawCount - filtered.length,
        exclusionReason:
          filtered.length === 0 && result.rawCount > 0
            ? "cargo-or-domestic-only"
            : undefined,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof FlightApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "UNKNOWN_ERROR", message: "조회 중 알 수 없는 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
