import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLoginForm } from "./AdminLoginForm";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("./AdminSessionProvider", () => ({
  useAdminSession: () => ({ login: mocks.login }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue({ role: "admin" });
});

describe("AdminLoginForm", () => {
  it("valida campos y permite mostrar u ocultar la contraseña", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    const password = screen.getByLabelText(/^Contraseña/);

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "INGRESAR AL PANEL" }));
    expect(
      await screen.findByText("Escribe tu correo o nombre de usuario."),
    ).toBeVisible();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("autentica con el contrato mínimo y navega al panel", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.type(
      screen.getByLabelText(/Correo o nombre de usuario/),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText(/^Contraseña/), "Clave-administrativa");
    await user.click(screen.getByRole("button", { name: "INGRESAR AL PANEL" }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        identifier: "admin@example.com",
        password: "Clave-administrativa",
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/admin");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("presenta un rechazo de rol sin revelar información interna", async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue(
      Object.assign(new Error("Detalle interno"), {
        code: "ADMIN_ROLE_REQUIRED",
        status: 403,
        requestId: "request-role",
      }),
    );
    render(<AdminLoginForm />);
    await user.type(
      screen.getByLabelText(/Correo o nombre de usuario/),
      "usuario@example.com",
    );
    await user.type(screen.getByLabelText(/^Contraseña/), "Clave-correcta");
    await user.click(screen.getByRole("button", { name: "INGRESAR AL PANEL" }));

    expect(
      await screen.findByText("Esta cuenta no tiene permisos administrativos."),
    ).toBeVisible();
    expect(screen.queryByText("Detalle interno")).not.toBeInTheDocument();
    expect(screen.getByText("REFERENCIA · request-role")).toBeVisible();
  });
});
