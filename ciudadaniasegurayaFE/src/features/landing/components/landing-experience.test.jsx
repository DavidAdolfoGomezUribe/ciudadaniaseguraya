import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LandingExperience } from "./LandingExperience";

vi.mock("@/components/feedback/AppBootLoader", () => ({
  AppBootLoader: ({ mapReady, statisticsReady }) => (
    <output
      aria-label="estado de inicio"
      data-map-ready={String(mapReady)}
      data-statistics-ready={String(statisticsReady)}
    />
  ),
}));

vi.mock("@/features/map/components/MapClientBoundary", () => ({
  MapClientBoundary: ({ onReady }) => (
    <button type="button" onClick={onReady}>
      mapa listo
    </button>
  ),
}));

vi.mock("@/features/statistics/components/StatisticsSection", () => ({
  StatisticsSection: ({ onReady }) => (
    <button type="button" onClick={onReady}>
      estadísticas listas
    </button>
  ),
}));

describe("LandingExperience", () => {
  it("renderiza el propósito y coordina la disponibilidad del mapa y estadísticas", async () => {
    const user = userEvent.setup();
    render(
      <LandingExperience purpose={<h1 id="landing-title">Seguridad ciudadana</h1>} />,
    );

    const status = screen.getByLabelText("estado de inicio");
    expect(screen.getByRole("heading", { name: "Seguridad ciudadana" })).toBeVisible();
    expect(status).toHaveAttribute("data-map-ready", "false");
    expect(status).toHaveAttribute("data-statistics-ready", "false");

    await user.click(screen.getByRole("button", { name: "mapa listo" }));
    expect(status).toHaveAttribute("data-map-ready", "true");
    expect(status).toHaveAttribute("data-statistics-ready", "false");

    await user.click(screen.getByRole("button", { name: "estadísticas listas" }));
    expect(status).toHaveAttribute("data-map-ready", "true");
    expect(status).toHaveAttribute("data-statistics-ready", "true");
  });
});
