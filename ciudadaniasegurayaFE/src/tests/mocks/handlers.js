export const API_BASE_URL = "http://localhost:3010";

export function apiUrl(path) {
  return new URL(path, API_BASE_URL).toString();
}

export const handlers = [];
