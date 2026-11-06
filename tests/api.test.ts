import { describe, expect, it } from "vitest";
import { parseFlightResponse } from "@/lib/api";

const masterPassenger = {
  fid: "master-1",
  codeshare: "Master",
  flightId: "KE901",
  airline: "대한항공",
  airport: "파리/샤를드골",
  airportCode: "CDG",
  passengerOrCargo: "Passenger",
  scheduleDatetime: "202611031000",
  estimatedDatetime: "202611031300",
  chkinRange: "A01-A12",
  gateNumber: "231",
  terminalId: "P02",
  remark: "지연",
  typeOfFlight: "I",
};

function payload(items: object | object[]) {
  return {
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      body: { items: { item: items }, totalCount: Array.isArray(items) ? items.length : 1 },
    },
  };
}

describe("API 응답 파싱", () => {
  it("단일 객체 응답을 정규화한다", () => {
    const result = parseFlightResponse(payload(masterPassenger), "departure", new Date("2026-11-03T01:00:00Z"));
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]).toMatchObject({
      flightId: "KE901",
      delayMinutes: 180,
      stage: "index-insurance",
      terminal: "탑승동",
      checkinCounter: "A01-A12",
    });
  });

  it("배열 응답과 대소문자가 다른 시간 필드를 파싱한다", () => {
    const result = parseFlightResponse(
      payload([{ ...masterPassenger, scheduleDatetime: undefined, estimatedDatetime: undefined, scheduleDateTime: "202611031000", estimatedDateTime: "202611031600" }]),
      "departure",
    );
    expect(result.flights[0].delayMinutes).toBe(360);
  });

  it("화물기, 국내선, 코드셰어 Slave를 제외한다", () => {
    const result = parseFlightResponse(
      payload([
        masterPassenger,
        { ...masterPassenger, fid: "cargo", flightId: "5Y8232", passengerOrCargo: "Cargo" },
        { ...masterPassenger, fid: "domestic", flightId: "KE1001", typeOfFlight: "D" },
        { ...masterPassenger, fid: "slave", flightId: "AF267", codeshare: "Slave", masterFlightId: "KE901" },
      ]),
      "departure",
    );
    expect(result.rawCount).toBe(4);
    expect(result.flights.map((flight) => flight.flightId)).toEqual(["KE901"]);
  });

  it("같은 마스터편과 예정시간의 중복 결과를 하나만 남긴다", () => {
    const result = parseFlightResponse(
      payload([masterPassenger, { ...masterPassenger, fid: "master-duplicate" }]),
      "departure",
    );
    expect(result.flights).toHaveLength(1);
  });

  it("도착편에는 체크인 카운터를 해당 없음으로 표시한다", () => {
    const result = parseFlightResponse(payload(masterPassenger), "arrival");
    expect(result.flights[0].checkinCounter).toBe("해당 없음");
  });
});
