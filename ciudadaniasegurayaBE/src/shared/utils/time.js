import { AppError } from "../errors/app-error.js";

export function monthInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find(({ type }) => type === "year").value;
  const month = parts.find(({ type }) => type === "month").value;
  return `${year}-${month}`;
}

export function assertReasonableOccurrence(date, now) {
  const maximumFutureDate = new Date(now.getTime() + 5 * 60_000);

  if (date > maximumFutureDate) {
    throw new AppError({
      code: "INVALID_OCCURRENCE_DATE",
      message: "La fecha del incidente no puede estar en el futuro",
      statusCode: 422,
    });
  }
}
