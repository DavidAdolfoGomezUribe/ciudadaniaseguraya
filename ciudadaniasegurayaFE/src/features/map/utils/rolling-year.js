export const ROLLING_YEAR_PERIOD = "rolling-year";
export const ROLLING_YEAR_LABEL = "Últimos 12 meses";

export function oneCalendarYearBefore(value) {
  const from = new Date(value);
  const expectedMonth = from.getUTCMonth();
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  if (from.getUTCMonth() !== expectedMonth) {
    from.setUTCDate(0);
  }

  return from;
}

export function rollingYearRange(now = new Date()) {
  const to = new Date(now);
  const from = oneCalendarYearBefore(to);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
