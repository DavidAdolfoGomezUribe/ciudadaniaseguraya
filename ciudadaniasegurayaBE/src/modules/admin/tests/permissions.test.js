import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  hasPermission,
  permissionsForRole,
} from "../permissions.js";

describe("matriz centralizada de permisos", () => {
  it("permite moderacion al admin pero no administrar privilegios", () => {
    expect(hasPermission("admin", PERMISSIONS.INCIDENTS_APPROVE)).toBe(true);
    expect(hasPermission("admin", PERMISSIONS.ADMINS_PROMOTE)).toBe(false);
    expect(hasPermission("admin", PERMISSIONS.SESSIONS_REVOKE)).toBe(true);
  });

  it("reserva cambios de autoridad y auditoria global al superadmin", () => {
    const permissions = permissionsForRole("superadmin");

    expect(permissions).toContain(PERMISSIONS.ADMINS_PROMOTE);
    expect(permissions).toContain(PERMISSIONS.ADMINS_DEMOTE);
    expect(permissions).toContain(PERMISSIONS.AUDIT_READ_ALL);
    expect(permissions).toContain(PERMISSIONS.INCIDENTS_APPROVE);
    expect(permissions).toContain(PERMISSIONS.AGENT_CONTROL);
    expect(hasPermission("admin", PERMISSIONS.AGENT_CONTROL)).toBe(false);
  });

  it("no concede permisos desconocidos ni roles inexistentes", () => {
    expect(hasPermission("superadmin", "internal.unknown")).toBe(false);
    expect(permissionsForRole("unknown")).toEqual([]);
  });
});
