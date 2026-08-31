"use client";

import { useIsRestoring } from "@tanstack/react-query";

export function QueryRestoreGate({ children, fallback = null }) {
  return useIsRestoring() ? fallback : children;
}
