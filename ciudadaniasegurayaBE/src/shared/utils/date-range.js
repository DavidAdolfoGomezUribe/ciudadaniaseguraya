export function oneCalendarYearBefore(value) {
  const from = new Date(value);
  const expectedMonth = from.getUTCMonth();
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  if (from.getUTCMonth() !== expectedMonth) {
    from.setUTCDate(0);
  }

  return from;
}
