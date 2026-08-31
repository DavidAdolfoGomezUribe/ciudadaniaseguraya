import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PermissionGate } from "./PermissionGate";

const mocks = vi.hoisted(() => ({ permissions: new Set() }));

vi.mock("@/features/admin/auth/components/AdminSessionProvider", () => ({
  useAdminSession: () => ({ permissions: mocks.permissions }),
}));

describe("PermissionGate", () => {
  it("solo muestra controles incluidos en los permisos efectivos", () => {
    mocks.permissions = new Set(["users.read"]);
    const { rerender } = render(
      <PermissionGate any={["admins.promote"]} fallback={<span>Solo lectura</span>}>
        <button>Promover</button>
      </PermissionGate>,
    );
    expect(screen.getByText("Solo lectura")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Promover" })).toBeNull();

    mocks.permissions = new Set(["admins.promote"]);
    rerender(
      <PermissionGate any={["admins.promote"]}>
        <button>Promover</button>
      </PermissionGate>,
    );
    expect(screen.getByRole("button", { name: "Promover" })).toBeVisible();
  });
});
