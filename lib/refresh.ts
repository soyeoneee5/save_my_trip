import type { FlightRecord } from "./types";

export const FLIGHT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function isTrackableFlight(flight: FlightRecord | null): boolean {
  return !!flight && !flight.isSimulation && flight.stage !== "cancelled" && !/^(출발|도착|완료|탑승 완료|DEPARTED|ARRIVED)$/i.test(flight.status.trim());
}

export function shouldRefreshFlight(options: { flight: FlightRecord | null; online: boolean; visible: boolean; stopped: boolean; inFlight: boolean; lastAttempt: number; now: number }): boolean {
  return isTrackableFlight(options.flight) && options.online && options.visible && !options.stopped && !options.inFlight && options.now - options.lastAttempt >= FLIGHT_REFRESH_INTERVAL_MS;
}
