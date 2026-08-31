import { expect, test } from "@playwright/test";

import { APP_URL, CITY_ID, installMockPlatform } from "./support/mock-platform";

test.use({ baseURL: APP_URL });

test.describe("reporte ciudadano autenticado", () => {
  test("completa ubicación, confirma y envía a validación comunitaria", async ({
    page,
    context,
  }) => {
    const backend = await installMockPlatform(page, { authenticated: true });
    await context.grantPermissions(["geolocation"], {
      origin: APP_URL,
    });
    await context.setGeolocation({
      latitude: 4.6515,
      longitude: -74.083,
    });

    await page.goto("/reportar-incidente");

    await expect(
      page.getByRole("heading", { name: "Reportar un incidente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Ubicación del incidente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "SELECCIÓN APROXIMADA" }),
    ).toBeVisible();

    await page.locator("#cityId").selectOption(CITY_ID);
    await page.locator("#incidentType").selectOption("hurto");
    await page.getByLabel("Título").fill("Hurto en transporte público");
    await page
      .locator("#description")
      .fill("El incidente ocurrió dentro de un bus urbano.");
    await page.getByLabel("Fecha").fill("2025-01-15");
    await page.getByLabel("Hora").fill("12:30");
    await page.getByRole("button", { name: /USAR MI POSICIÓN/ }).click();
    await expect(page.getByLabel("Latitud")).toHaveValue("4.6515");
    await expect(page.getByLabel("Longitud")).toHaveValue("-74.083");
    await page.getByLabel("Dirección aproximada").fill("Carrera 7 # 10-20");
    await page.getByLabel("Precisión de la ubicación").selectOption("hexagon");
    await page.getByLabel("Barrio").fill("Centro");
    await page
      .getByLabel("Enlace de noticia o fuente")
      .fill("https://example.com/noticia");
    await page
      .getByLabel("Descripción de evidencia")
      .fill("Nota publicada por un medio local.");
    await page
      .getByRole("checkbox", {
        name: /Confirmo que la ubicación seleccionada/,
      })
      .check();

    await expect(page.getByText("VISTA PREVIA · H3 9")).toBeVisible();
    await expect(
      page.getByText(
        "El envío quedará pendiente. La plataforma no lo presentará como información validada hasta completar el proceso correspondiente.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "ENVIAR REPORTE" }).click();

    await expect(
      page.getByRole("heading", { name: "Tu reporte fue recibido" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "El sistema buscará coincidencias y aplicará el proceso de validación comunitaria.",
        { exact: false },
      ),
    ).toBeVisible();
    expect(backend.received.reports).toEqual([
      {
        cityId: CITY_ID,
        incidentType: "hurto",
        title: "Hurto en transporte público",
        description: "El incidente ocurrió dentro de un bus urbano.",
        occurredAt: "2025-01-15T17:30:00.000Z",
        latitude: 4.6515,
        longitude: -74.083,
        locationPrecision: "hexagon",
        address: "Carrera 7 # 10-20",
        neighborhood: "Centro",
        sourceUrl: "https://example.com/noticia",
        evidenceDescription: "Nota publicada por un medio local.",
      },
    ]);
    expect(
      backend.requests.find((request) => request.path === "/api/v1/incidents/reports")
        ?.authorization,
    ).toBe("Bearer e2e-refreshed-token");
    expect(backend.googleRequests).toEqual([]);
  });

  test("bloquea coordenadas inválidas y exige confirmación", async ({ page }) => {
    const backend = await installMockPlatform(page, { authenticated: true });

    await page.goto("/reportar-incidente");
    await page.locator("#incidentType").selectOption("hurto");
    await page.getByLabel("Título").fill("Incidente para validar");
    await page
      .locator("#description")
      .fill("Descripción suficiente para validar el formulario.");
    await page.getByLabel("Fecha").fill("2025-01-15");
    await page.getByLabel("Hora").fill("12:30");
    await page.getByLabel("Latitud").fill("91");
    await page.getByRole("button", { name: "ENVIAR REPORTE" }).click();

    await expect(
      page.getByText("Confirma que la ubicación corresponde al incidente."),
    ).toBeVisible();
    await expect(page.getByLabel("Latitud")).toHaveAttribute("aria-invalid", "true");
    expect(backend.received.reports).toEqual([]);
  });
});
