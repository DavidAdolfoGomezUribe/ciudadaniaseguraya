import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "./Header";

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    logout: vi.fn(),
    status: "authenticated",
    user: { role: "user", username: "ciudadana" },
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/auth/components/AuthProvider", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/features/theme/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

beforeEach(() => {
  mocks.auth.isAuthenticated = true;
  mocks.auth.status = "authenticated";
  mocks.auth.user = { role: "user", username: "ciudadana" };
  mocks.auth.logout.mockReset();
});

describe("Header", () => {
  it("muestra el panel de superadmin solo para ese rol", async () => {
    const user = userEvent.setup();
    mocks.auth.user = { role: "superadmin", username: "superadmin" };

    render(<Header />);
    await user.click(screen.getByRole("button", { name: "CUENTA" }));

    expect(
      screen.getByRole("menuitem", { name: "Panel de superadmin" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("identifica el acceso de un administrador", async () => {
    const user = userEvent.setup();
    mocks.auth.user = { role: "admin", username: "moderadora" };

    render(<Header />);
    await user.click(screen.getByRole("button", { name: "CUENTA" }));

    expect(
      screen.getByRole("menuitem", { name: "Panel administrativo" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("no ofrece acceso administrativo a un usuario normal", async () => {
    const user = userEvent.setup();

    render(<Header />);
    await user.click(screen.getByRole("button", { name: "CUENTA" }));

    expect(
      screen.queryByRole("menuitem", { name: /Panel (administrativo|de superadmin)/ }),
    ).not.toBeInTheDocument();
  });
});
