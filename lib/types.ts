export type FlightDirection = "departure" | "arrival";

export type ResponseStage =
  | "check"
  | "index-insurance"
  | "expense-insurance"
  | "long-delay"
  | "cancelled"
  | "unknown";

export interface FlightRecord {
  id: string;
  flightId: string;
  airline: string;
  airport: string;
  airportCode: string;
  scheduleDatetime: string;
  estimatedDatetime: string | null;
  delayMinutes: number | null;
  status: string;
  terminal: string;
  terminalCode: string;
  gate: string;
  checkinCounter: string;
  direction: FlightDirection;
  lastUpdatedAt: string;
  isSimulation: boolean;
  stage: ResponseStage;
}

export interface FlightSearchResponse {
  flights: FlightRecord[];
  meta: {
    direction: FlightDirection;
    normalizedFlightId: string;
    searchedDate: string;
    filteredCount: number;
    excludedCount: number;
    exclusionReason?: "cargo-or-domestic-only";
  };
}
