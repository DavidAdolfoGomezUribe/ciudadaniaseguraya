import { describe, expect, it } from "vitest";

import { syncSuperadmin } from "../sync-superadmin.js";

describe("sincronizacion del superadmin", () => {
  it("no toca la base de datos cuando las credenciales no estan configuradas", async () => {
    await expect(
      syncSuperadmin({
        config: {
          superadminEmail: "",
          superadminUsername: "",
          superadminPassword: "",
          superadminDisplayName: "",
        },
      }),
    ).resolves.toEqual({ status: "skipped" });
  });

  it("rechaza una configuracion parcial antes de tocar la base de datos", async () => {
    await expect(
      syncSuperadmin({
        config: {
          superadminEmail: "admin@example.test",
          superadminUsername: "",
          superadminPassword: "",
          superadminDisplayName: "",
        },
      }),
    ).rejects.toThrow("deben configurarse juntos");
  });
});
