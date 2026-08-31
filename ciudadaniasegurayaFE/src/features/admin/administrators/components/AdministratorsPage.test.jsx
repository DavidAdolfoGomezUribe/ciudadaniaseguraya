import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdministratorsPage } from "./AdministratorsPage";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  session: {
    user: { id: "superadmin-id", role: "superadmin" },
    permissions: new Set([
      "admins.read",
      "admins.update",
      "admins.demote",
      "admins.suspend",
    ]),
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/administrators",
}));

vi.mock("@/features/admin/auth/components/AdminSessionProvider", () => ({
  useAdminSession: () => mocks.session,
}));

vi.mock("../../shared/use-debounced-value", () => ({
  useDebouncedValue: (value) => value,
}));

vi.mock("../../services/admin.service", () => ({
  adminService: {
    administrators: {
      list: mocks.list,
    },
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdministratorsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({
    items: [
      {
        id: "admin-id",
        username: "ana_admin",
        displayName: "Ana Moderadora",
        email: "ana@example.com",
        role: "admin",
        status: "active",
        promotedAt: "2026-08-01T12:00:00.000Z",
      },
    ],
    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  });
});

describe("AdministratorsPage", () => {
  it("busca por nombre o correo y enlaza a la ficha administrativa", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect((await screen.findAllByText("ana@example.com")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "ana_admin" })[0]).toHaveAttribute(
      "href",
      "/admin/administrators/admin-id",
    );

    await user.type(
      screen.getByPlaceholderText("Nombre, usuario o correo"),
      "ana@example.com",
    );

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "ana@example.com" }),
        expect.anything(),
      );
    });
  });
});
