export function normalizeEmail(value) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function normalizeUsername(value) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
