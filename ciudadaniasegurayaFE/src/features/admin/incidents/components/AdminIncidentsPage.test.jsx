import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminIncidentsPage } from "./AdminIncidentsPage";

const mocks = vi.hoisted(() => ({
  listIncidents: vi.fn(),
  cities: [
    { id: "507f1f77bcf86cd799439011", name: "Bogotá" },
    { id: "507f1f77bcf86cd799439012", name: "Medellín" },
  ],
  incidentTypes: [
    { code: "theft", name: "Hurto" },
    { code: "assault", name: "Agresión" },
  ],
}));

vi.mock("@/features/map/hooks/useCatalogs", () => ({
  useCities: () => ({
    data: mocks.cities,
    isPending: false,
    isError: false,
  }),
  useIncidentTypes: () => ({
    data: mocks.incidentTypes,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("../../services/admin.service", () => ({
  adminService: {
    incidents: {
      list: mocks.listIncidents,
    },
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminIncidentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listIncidents.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
  });
});

describe("AdminIncidentsPage", () => {
  it("filtra por una ciudad legible y conserva el orden inicial de la cola", async () => {
    const user = userEvent.setup();
    renderPage();

    const city = screen.getByLabelText("CIUDAD PRINCIPAL");
    expect(city).toHaveDisplayValue("Todas las ciudades");
    expect(screen.getByRole("option", { name: "Bogotá" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Medellín" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Hurto" })).toBeVisible();

    await waitFor(() => {
      expect(mocks.listIncidents).toHaveBeenCalledWith(
        expect.objectContaining({
          cityId: "",
          sortBy: "createdAt",
          sortOrder: "asc",
        }),
        expect.anything(),
      );
    });

    await user.selectOptions(city, "507f1f77bcf86cd799439012");

    await waitFor(() => {
      expect(mocks.listIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cityId: "507f1f77bcf86cd799439012",
          sortBy: "createdAt",
          sortOrder: "asc",
        }),
        expect.anything(),
      );
    });
  });

  it("identifica visualmente los incidentes enviados por la IA", async () => {
    mocks.listIncidents.mockResolvedValueOnce({
      items: [
        {
          id: "507f1f77bcf86cd799439013",
          title: "Incidente detectado por IA",
          incidentType: "hurto",
          cityName: "Bogotá",
          neighborhood: "Centro",
          occurredAt: "2026-08-28T23:30:00.000Z",
          createdAt: "2026-08-29T00:00:00.000Z",
          sourceUrls: ["https://example.com/noticia"],
          reportCount: 0,
          status: "pending",
          submissionSource: "ai_scraper",
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    renderPage();

    const tags = await screen.findAllByText("IA · SCRAPING");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toBeVisible();
  });
});
