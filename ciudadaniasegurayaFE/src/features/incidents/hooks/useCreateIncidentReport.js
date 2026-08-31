"use client";

import { useMutation } from "@tanstack/react-query";

import { incidentsService } from "../services/incidents.service";

export function useCreateIncidentReport() {
  return useMutation({
    mutationFn: (payload) => incidentsService.createReport(payload),
  });
}
