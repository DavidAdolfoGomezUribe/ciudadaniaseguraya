import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  createAccount: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    login: mocks.login,
    register: mocks.createAccount,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue(undefined);
  mocks.createAccount.mockResolvedValue(undefined);
});

describe("LoginForm", () => {
  it("no muestra una opción de acceso con Google", () => {
    render(<LoginForm />);

    expect(screen.queryByText(/Google/i)).not.toBeInTheDocument();
  });

  it("muestra validaciones accesibles antes de llamar al servicio", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "INICIAR SESIÓN" }));

    expect(
      await screen.findByText("Escribe tu correo o nombre de usuario."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByText("Escribe tu contraseña.")).toHaveAttribute("role", "alert");
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("normaliza credenciales y navega al destino interno tras autenticar", async () => {
    const user = userEvent.setup();
    render(<LoginForm returnTo="/cuenta?tab=seguridad" />);

    await user.type(
      screen.getByLabelText(/Correo o nombre de usuario/),
      "  ciudadana  ",
    );
    await user.type(screen.getByLabelText(/^Contraseña/), "secreto");
    await user.click(screen.getByRole("button", { name: "INICIAR SESIÓN" }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        identifier: "ciudadana",
        password: "secreto",
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/cuenta?tab=seguridad");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("presenta el error del backend sin navegar", async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValueOnce(
      Object.assign(new Error("Credenciales inválidas."), {
        requestId: "request-login",
      }),
    );
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/Correo o nombre de usuario/), "ciudadana");
    await user.type(screen.getByLabelText(/^Contraseña/), "incorrecta");
    await user.click(screen.getByRole("button", { name: "INICIAR SESIÓN" }));

    expect(await screen.findByText("Credenciales inválidas.")).toBeVisible();
    expect(screen.getByText(/request-login/i)).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe("RegisterForm", () => {
  async function fillRegistration(user, { confirm = "Clave-Segura-2026" } = {}) {
    await user.type(screen.getByLabelText(/Nombre de usuario/), "ciudadana_26");
    await user.type(
      screen.getByLabelText(/Correo electrónico/),
      "ciudadana@example.com",
    );
    await user.type(screen.getByLabelText(/^Contraseña/), "Clave-Segura-2026");
    await user.type(screen.getByLabelText(/Confirmar contraseña/), confirm);
  }

  it("no muestra una opción de registro con Google", () => {
    render(<RegisterForm />);

    expect(screen.queryByText(/Google/i)).not.toBeInTheDocument();
  });

  it("impide registrar contraseñas distintas", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRegistration(user, { confirm: "Otra-Clave-2026" });
    await user.click(
      screen.getByRole("checkbox", {
        name: /Acepto los términos/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "CREAR CUENTA" }));

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeVisible();
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("exige aceptar los términos y el aviso de privacidad", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: "CREAR CUENTA" }));

    expect(
      await screen.findByText("Debes aceptar los términos y el aviso de privacidad."),
    ).toBeVisible();
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("envia solo el contrato del backend, limpia secretos y navega", async () => {
    const user = userEvent.setup();
    render(<RegisterForm returnTo="/reportar-incidente" />);

    await fillRegistration(user);
    await user.click(
      screen.getByRole("checkbox", {
        name: /Acepto los términos/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "CREAR CUENTA" }));

    await waitFor(() =>
      expect(mocks.createAccount).toHaveBeenCalledWith({
        username: "ciudadana_26",
        email: "ciudadana@example.com",
        password: "Clave-Segura-2026",
      }),
    );
    expect(screen.getByLabelText(/^Contraseña/)).toHaveValue("");
    expect(screen.getByLabelText(/Confirmar contraseña/)).toHaveValue("");
    expect(mocks.replace).toHaveBeenCalledWith("/reportar-incidente");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("limpia secretos y conserva un error de registro visible", async () => {
    const user = userEvent.setup();
    mocks.createAccount.mockRejectedValueOnce(
      Object.assign(new Error("El correo ya está registrado."), {
        requestId: "request-register",
      }),
    );
    render(<RegisterForm />);

    await fillRegistration(user);
    await user.click(
      screen.getByRole("checkbox", {
        name: /Acepto los términos/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "CREAR CUENTA" }));

    expect(await screen.findByText("El correo ya está registrado.")).toBeVisible();
    expect(screen.getByLabelText(/^Contraseña/)).toHaveValue("");
    expect(screen.getByLabelText(/Confirmar contraseña/)).toHaveValue("");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
