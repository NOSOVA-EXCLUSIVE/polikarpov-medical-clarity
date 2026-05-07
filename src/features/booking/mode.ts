import "server-only";

export type BookingMode = "manual" | "live";

export function getBookingMode(): BookingMode {
  return process.env.BOOKING_MODE?.trim().toLowerCase() === "live" ? "live" : "manual";
}

export function isManualBookingMode() {
  return getBookingMode() === "manual";
}
