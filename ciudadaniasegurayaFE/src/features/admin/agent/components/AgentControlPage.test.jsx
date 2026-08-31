import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentControlPage } from "./AgentControlPage";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("../../services/admin.service", () => ({
  adminService: {
    agent: mocks,
  },
}));

const status = {
  serviceActive: true,
  busy: false,
  providers: {
    openai: {
      available: true,
      defaultModel: "gpt-5.6-luna",
      models: ["gpt-5.6-luna"],
      message: null,
    },
    ollama: {
      available: true,
      defaultModel: "qwen3:8b",
      models: ["qwen3:8b", "gemma3:4b"],
      message: null,
    },
  },
  run: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentControlPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status.mockResolvedValue(status);
  mocks.start.mockResolvedValue({ id: "a".repeat(32), status: "collecting" });
  mocks.cancel.mockResolvedValue({});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("AgentControlPage", () => {
  it("switches to an installed Ollama model and requires explicit ingestion approval", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("SERVICIO DISPONIBLE")).toBeVisible();
    expect(screen.getByLabelText("Modelo")).toHaveDisplayValue("gpt-5.6-luna");

    await user.click(screen.getByRole("radio", { name: "OLLAMA LOCAL" }));
    expect(screen.getByLabelText("Modelo")).toHaveDisplayValue("qwen3:8b");
    await user.selectOptions(screen.getByLabelText("Modelo"), "gemma3:4b");
    await user.clear(screen.getByLabelText("Objetivo de noticias válidas"));
    await user.type(screen.getByLabelText("Objetivo de noticias válidas"), "12");
    await user.clear(screen.getByLabelText("Máximo de noticias a revisar"));
    await user.type(screen.getByLabelText("Máximo de noticias a revisar"), "60");
    await user.click(screen.getByRole("checkbox", { name: /Enviar válidos/ }));
    await user.click(screen.getByRole("button", { name: /EJECUTAR/ }));

    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalledWith(
        {
          provider: "ollama",
          model: "gemma3:4b",
          limit: 12,
          maxArticles: 60,
          ingest: true,
          confirmIngest: true,
        },
        expect.anything(),
      );
    });
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("se enviarán al backend"),
    );
  });
});
