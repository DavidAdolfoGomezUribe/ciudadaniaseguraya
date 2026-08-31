import { expect, test } from "@playwright/test";

import { APP_URL } from "./support/mock-platform";
import { installMockAdminPlatform } from "./support/mock-admin-platform";

test.use({ baseURL: APP_URL });

test("protege, autentica y limita el panel según permisos efectivos", async ({
  page,
}) => {
  const backend = await installMockAdminPlatform(page);

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\/admin(?:\?.*)?$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "ACCESO ADMINISTRATIVO" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "INICIAR SESIÓN" })).toHaveCount(0);

  await page.getByLabel("Correo o nombre de usuario").fill("admin@example.com");
  await page.locator("#admin-password").fill("Clave-administrativa-2026");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.locator("#admin-password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "INGRESAR AL PANEL" }).click();

  await expect
    .poll(() => backend.received.login.length, {
      message: JSON.stringify(backend.requests),
    })
    .toBe(1);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Panel de control" })).toBeVisible();
  const openMenu = page.getByRole("button", {
    name: "Abrir menú administrativo",
  });
  if (await openMenu.isVisible()) await openMenu.click();
  await expect(page.getByRole("link", { name: "RESUMEN" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ADMINISTRADORES" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CONFIGURACIÓN" })).toHaveCount(0);
  expect(backend.received.login).toEqual([
    {
      identifier: "admin@example.com",
      password: "Clave-administrativa-2026",
    },
  ]);

  await expect
    .poll(
      () =>
        backend.requests.find(
          (request) => request.path === "/api/v1/admin/events/stream",
        )?.authorization,
      { timeout: 15_000 },
    )
    .toBe("Bearer admin-access-e2e-token");

  await page.goto("/admin/settings");
  await expect(
    page.getByRole("heading", {
      name: "Esta sesión no tiene permiso para consultar el módulo",
    }),
  ).toBeVisible();
  expect(
    backend.requests.filter((request) => request.path === "/api/v1/admin/settings"),
  ).toHaveLength(0);

  await page.getByRole("button", { name: "Cerrar sesión administrativa" }).click();
  await expect(page).toHaveURL(/\/login\/admin$/, { timeout: 15_000 });
  expect(backend.received.logout).toHaveLength(1);
  expect(backend.pageErrors).toEqual([]);
});
