import { expect, test } from "@playwright/test";

import { APP_URL, installMockPlatform } from "./support/mock-platform";

test.use({ baseURL: APP_URL });

async function fillLogin(page) {
  await page.getByLabel("Correo o nombre de usuario").fill("ciudadana@example.com");
  await page.locator("#password").fill("Clave-Segura-2026");
}

async function fillRegistration(page) {
  await page.getByLabel("Nombre de usuario").fill("ciudadana_e2e");
  await page.getByLabel("Correo electrónico").fill("ciudadana@example.com");
  await page.locator("#password").fill("Clave-Segura-2026");
  await page.locator("#confirmPassword").fill("Clave-Segura-2026");
  await page.getByRole("checkbox", { name: /Acepto los términos/ }).check();
}

test.describe("autenticación", () => {
  test("protege el reporte y conserva la ruta de retorno", async ({ page }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/reportar-incidente");

    await page.waitForTimeout(1_000);
    expect(backend.pageErrors).toEqual([]);
    await expect
      .poll(
        () => backend.requests.map((request) => `${request.method} ${request.path}`),
        { timeout: 15_000 },
      )
      .toContain("GET /api/v1/auth/me");
    await expect
      .poll(
        () => backend.requests.map((request) => `${request.method} ${request.path}`),
        { timeout: 15_000 },
      )
      .toContain("POST /api/v1/auth/refresh");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Freportar-incidente$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "/registro?returnTo=%2Freportar-incidente",
    );
  });

  test("inicia sesión, respeta returnTo y permite cerrar la sesión", async ({
    page,
  }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/login?returnTo=%2Fcuenta");
    await fillLogin(page);
    await page.getByRole("button", { name: "INICIAR SESIÓN" }).click();

    await expect(page).toHaveURL(/\/cuenta$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Tu información" })).toBeVisible();
    await expect(page.getByText("ciudadana_e2e")).toBeVisible();
    expect(backend.received.login).toEqual([
      {
        identifier: "ciudadana@example.com",
        password: "Clave-Segura-2026",
      },
    ]);

    await page.getByRole("button", { name: "CUENTA" }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcuenta$/);
    await expect(page.getByRole("link", { name: "INICIAR SESIÓN" })).toBeVisible();
    expect(backend.received.logout).toHaveLength(1);
    expect(
      backend.requests.find((request) => request.path === "/api/v1/auth/logout")
        ?.authorization,
    ).toBe("Bearer e2e-access-token");
  });

  test("muestra el error de credenciales con su referencia", async ({ page }) => {
    await installMockPlatform(page, { loginError: true });

    await page.goto("/login");
    await fillLogin(page);
    await page.getByRole("button", { name: "INICIAR SESIÓN" }).click();

    await expect(page.getByText("Credenciales inválidas.")).toBeVisible();
    await expect(page.getByText("REFERENCIA · request-login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registra solo el contrato permitido y abre la cuenta", async ({ page }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/registro?returnTo=%2Fcuenta");
    await fillRegistration(page);
    await page.getByRole("button", { name: "CREAR CUENTA" }).click();

    await expect(page).toHaveURL(/\/cuenta$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Tu información" })).toBeVisible();
    expect(backend.received.register).toEqual([
      {
        username: "ciudadana_e2e",
        email: "ciudadana@example.com",
        password: "Clave-Segura-2026",
      },
    ]);
  });

  test("mantiene el registro editable cuando el correo ya existe", async ({ page }) => {
    await installMockPlatform(page, { registerError: true });

    await page.goto("/registro");
    await fillRegistration(page);
    await page.getByRole("button", { name: "CREAR CUENTA" }).click();

    await expect(page.getByText("El correo ya está registrado.")).toBeVisible();
    await expect(page.getByText("REFERENCIA · request-register-error")).toBeVisible();
    await expect(page.locator("#password")).toHaveValue("");
    await expect(page.locator("#confirmPassword")).toHaveValue("");
    await expect(page).toHaveURL(/\/registro$/);
  });
});
