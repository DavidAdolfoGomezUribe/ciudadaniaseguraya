const monthLabels = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function fillMonths(series) {
  const byMonth = new Map(series.map((item) => [String(item.key).slice(-2), item]));
  return monthLabels.map((label, index) => {
    const key = String(index + 1).padStart(2, "0");
    const item = byMonth.get(key);
    return {
      key,
      label,
      incidentCount: item?.incidentCount ?? 0,
    };
  });
}

export function fillRollingMonths(series, endDate) {
  const byMonth = new Map(series.map((item) => [String(item.key), item]));
  const end = new Date(endDate);

  return Array.from({ length: 12 }, (_, index) => {
    const offset = 11 - index;
    const date = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1),
    );
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const item = byMonth.get(key);

    return {
      key,
      label: `${monthLabels[month]} ${String(year).slice(-2)}`,
      incidentCount: item?.incidentCount ?? 0,
    };
  });
}

export function fillHours(series) {
  const byHour = new Map(
    series.map((item) => [Number.parseInt(String(item.key).slice(0, 2), 10), item]),
  );
  return Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour).padStart(2, "0"),
    label: `${String(hour).padStart(2, "0")}:00`,
    incidentCount: byHour.get(hour)?.incidentCount ?? 0,
  }));
}

export function seriesSummary(series) {
  if (!series.length) {
    return {
      total: 0,
      maximum: null,
      minimum: null,
      average: 0,
    };
  }

  const total = series.reduce((sum, item) => sum + item.incidentCount, 0);
  const sorted = [...series].sort(
    (left, right) => right.incidentCount - left.incidentCount,
  );
  return {
    total,
    maximum: sorted[0],
    minimum: sorted.at(-1),
    average: total / series.length,
  };
}
