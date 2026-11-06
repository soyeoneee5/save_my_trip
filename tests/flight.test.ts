import { describe, expect, it } from "vitest";
import {
  calculateDelayMinutes,
  classifyResponseStage,
  formatApiDatetime,
  isValidFlightId,
  normalizeFlightId,
  terminalLabel,
} from "@/lib/flight";

describe("항공편 입력 정규화", () => {
  it("공백을 제거하고 영문을 대문자로 바꾼다", () => {
    expect(normalizeFlightId(" ke 901 ")).toBe("KE901");
  });

  it("일반적인 항공편명 형식만 허용한다", () => {
    expect(isValidFlightId("KE901")).toBe(true);
    expect(isValidFlightId("5Y8232")).toBe(true);
    expect(isValidFlightId("대한항공901")).toBe(false);
    expect(isValidFlightId("KE")).toBe(false);
  });
});

describe("지연시간 계산", () => {
  it("날짜가 바뀌는 지연도 분 단위로 계산한다", () => {
    expect(calculateDelayMinutes("202611032300", "202611040100")).toBe(120);
  });

  it("변경시간이 없거나 비정상이면 계산하지 않는다", () => {
    expect(calculateDelayMinutes("202611031000", null)).toBeNull();
    expect(calculateDelayMinutes("202611031000", "202613991299")).toBeNull();
    expect(formatApiDatetime("not-a-date")).toBe("확인 필요");
  });

  it("예정보다 이른 변경시간은 지연 0분으로 처리한다", () => {
    expect(calculateDelayMinutes("202611031000", "202611030950")).toBe(0);
  });
});

describe("대응 단계 시간 경계", () => {
  it.each([
    [119, "check"],
    [120, "index-insurance"],
    [240, "index-insurance"],
    [241, "expense-insurance"],
    [720, "expense-insurance"],
    [721, "long-delay"],
  ])("%i분을 %s 단계로 분류한다", (minutes, expected) => {
    expect(classifyResponseStage(minutes, "지연")).toBe(expected);
  });

  it("결항은 지연시간보다 우선한다", () => {
    expect(classifyResponseStage(10, "결항")).toBe("cancelled");
  });

  it("변경시간을 계산할 수 없으면 확인 단계가 된다", () => {
    expect(classifyResponseStage(null, "운항정보 확인")).toBe("unknown");
  });
});

describe("터미널 표시", () => {
  it.each([
    ["P01", "제1터미널"],
    ["P02", "탑승동"],
    ["P03", "제2터미널"],
    ["C01", "확인 필요"],
  ])("%s를 %s로 표시한다", (code, expected) => {
    expect(terminalLabel(code)).toBe(expected);
  });
});
