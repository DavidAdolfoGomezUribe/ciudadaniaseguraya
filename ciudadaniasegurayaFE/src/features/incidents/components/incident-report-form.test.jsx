import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentReportForm } from "./IncidentReportForm";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  mutation: {
    mutateAsync: null,
    error: null,
    isPending: false,
  },
}));

mocks.mutation.mutateAsync = mocks.mutateAsync;

vi.mock("@/features/map/hooks/useCatalogs", () => ({
  useCities: () => ({
    data: [{ id: "64b7f0e4a1c2d3e4f5a6b7c8", name: "Bogotá" }],
    isPending: false,
  }),
  useIncidentTypes: () => ({
    data: [{ code: "theft", name: "Hurto" }],
    isPending: false,
  }),
}));

vi.mock("../hooks/useCreateIncidentReport", () => ({
  useCreateIncidentReport: () => mocks.mutation,
}));

vi.mock("./IncidentLocationPicker", () => ({
  IncidentLocationPicker: ({ latitude, longitude }) => (
    <div data-testid="location">
      {latitude},{longitude}
    </div>
  ),
}));

vi.mock("./ReportConfirmation", () => ({
  ReportConfirmation: () => <h2>Tu reporte fue recibido</h2>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutation.error = null;
  mocks.mutation.isPending = false;
  mocks.mutateAsync.mockResolvedValue({ id: "report-id" });
});

describe("IncidentReportForm", () => {
  it("valida los campos obligatorios antes de enviar", async () => {
    const user = userEvent.setup();
    render(<IncidentReportForm />);

    await user.click(screen.getByRole("button", { name: "ENVIAR REPORTE" }));

    expect(await screen.findByText("Selecciona un tipo de incidente.")).toBeVisible();
    expect(screen.getByText("Escribe al menos 5 caracteres.")).toBeVisible();
    expect(screen.getByText("Escribe al menos 10 caracteres.")).toBeVisible();
    expect(
      screen.getByText("Confirma que la ubicación corresponde al incidente."),
    ).toBeVisible();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("envia un payload compatible y muestra la confirmacion", async () => {
    const user = userEvent.setup();
    render(<IncidentReportForm />);

    await user.selectOptions(screen.getByLabelText(/Tipo de incidente/), "theft");
    await user.type(screen.getByLabelText(/^Título/), "Hurto en transporte público");
    await user.type(
      screen.getByLabelText(/^Descripción/, {
        selector: "textarea#description",
      }),
      "El incidente ocurrió dentro de un bus urbano.",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /Confirmo que la ubicación seleccionada/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "ENVIAR REPORTE" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: "64b7f0e4a1c2d3e4f5a6b7c8",
        incidentType: "theft",
        title: "Hurto en transporte público",
        description: "El incidente ocurrió dentro de un bus urbano.",
        latitude: 4.711,
        longitude: -74.0721,
        locationPrecision: "approximate",
        occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Tu reporte fue recibido" }),
    ).toBeVisible();
  });
});
