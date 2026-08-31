import { expect, test } from "@playwright/test";

import {
  APP_URL,
  CITY_ID,
  emitRealtime,
  HEXAGON_INDEX,
  installMockPlatform,
  MAP_HEXAGON_INDEX,
} from "./support/mock-platform";

test.use({ baseURL: APP_URL });

async function waitForApplication(page) {
  const loader = page.getByRole("status", {
    name: "Inicializando Ciudadanía Segura Ya",
  });
  await expect(loader).toBeVisible();
  await expect(loader).toBeHidden({ timeout: 20_000 });
}

function requestedHeatmapResolutions(backend) {
  return backend.requests
    .filter((request) => request.path === "/api/v1/geolocation/heatmap")
    .map((request) => Number(new URL(request.url).searchParams.get("resolution")));
}

async function expectMapCanvasesAligned(page) {
  const mapCanvas = page.locator(".map-shell .maplibregl-canvas");
  const deckCanvas = page.locator(".map-shell canvas:not(.maplibregl-canvas)").first();

  await expect(mapCanvas).toBeVisible();
  await expect(deckCanvas).toBeVisible();

  const [mapRect, deckRect] = await Promise.all([
    mapCanvas.boundingBox(),
    deckCanvas.boundingBox(),
  ]);

  expect(mapRect).not.toBeNull();
  expect(deckRect).not.toBeNull();
  for (const property of ["x", "y", "width", "height"]) {
    expect(Math.abs(mapRect[property] - deckRect[property])).toBeLessThanOrEqual(1);
  }
}

async function expectMapMatchesLandingHeight(page) {
  const [purposeRect, mapRect] = await Promise.all([
    page
      .locator("section[aria-labelledby='landing-title'] > div")
      .first()
      .boundingBox(),
    page.locator("section[aria-labelledby='landing-title'] > div").nth(1).boundingBox(),
  ]);

  expect(purposeRect).not.toBeNull();
  expect(mapRect).not.toBeNull();
  expect(Math.abs(purposeRect.height - mapRect.height)).toBeLessThanOrEqual(1);
}

test.describe("landing y mapa ciudadano", () => {
  test("presenta loader, cabecera, propósito, tecnología, footer y contacto", async ({
    page,
  }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/");
    await waitForApplication(page);
    expect(backend.pageErrors).toEqual([]);

    await expect(
      page.getByRole("link", {
        name: "Ciudadanía Segura Ya, página principal",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "INICIAR SESIÓN" })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /SEGURIDAD CIUDADANA.*VISUALIZADA POR ZONAS/,
      }),
    ).toBeVisible();
    await expect(page.getByText("ÍNDICE")).toBeVisible();
    await expect(page.getByText("H3", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "De reportes aislados a contexto colectivo",
      }),
    ).toBeVisible();

    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("heading", { name: "Hablemos de la plataforma" }),
    ).toBeVisible();
    await expect(footer.getByRole("link", { name: "CONTACTARNOS" })).toHaveAttribute(
      "href",
      "mailto:dav.studios95@gmail.com?subject=Contacto%20Ciudadanía%20Segura%20Ya",
    );
    await expect(footer.getByText("dav.studios95@gmail.com")).toBeVisible();
    expect(backend.googleRequests).toEqual([]);
  });

  test("alterna el tema y conserva la elección al recargar", async ({ page }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/");
    await waitForApplication(page);

    const root = page.locator("html");
    const themeMeta = page.locator('meta[name="theme-color"]');
    const toggle = page.getByRole("switch", { name: "Tema oscuro" });
    const lightBackground = await root.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--background-primary").trim(),
    );

    await expect(root).toHaveAttribute("data-theme", "light");
    await expect(themeMeta).toHaveAttribute("content", "#eeeadd");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();

    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(themeMeta).toHaveAttribute("content", "#27160e");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("csy-theme")))
      .toBe("dark");

    const darkBackground = await root.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--background-primary").trim(),
    );
    expect(darkBackground).not.toBe(lightBackground);

    await page.reload();
    await waitForApplication(page);
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(themeMeta).toHaveAttribute("content", "#27160e");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(backend.pageErrors).toEqual([]);
  });

  test("muestra la ventana anual, enfoca Bogotá y procesa realtime simulado", async ({
    page,
  }) => {
    const backend = await installMockPlatform(page);

    await page.goto("/");
    await waitForApplication(page);

    await expect(page.getByLabel("Mapa interactivo de Bogotá")).toBeVisible();
    const legend = page.getByLabel("Leyenda de cantidad de incidentes");
    await expect(legend).toContainText("REGISTROS VALIDADOS");
    await expect(legend).toContainText("Sin registros");
    await expect(legend).toContainText("Azul indica ausencia de registros validados");

    await page.getByRole("button", { name: "EXPLORAR MAPA" }).click();
    await expect(
      page.getByRole("button", { name: "Activar controles del mapa" }),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: /LIBERAR RUEDA/ })).toBeVisible();

    await expect(page.getByLabel("PERIODO")).toContainText("Últimos 12 meses");
    await expect
      .poll(() =>
        backend.requests.some(
          (request) =>
            request.path === "/api/v1/geolocation/heatmap" &&
            !request.url.includes("month="),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Volver a encuadrar Bogotá" }),
    ).toBeVisible();

    await emitRealtime(page, "heatmap.updated", {
      id: "event-e2e-1",
      type: "heatmap.updated",
      occurredAt: "2026-07-26T12:05:00.000Z",
      data: {
        cityId: CITY_ID,
        updates: [
          {
            h3Index: MAP_HEXAGON_INDEX,
            resolution: 7,
            period: "rolling-year",
            incidentType: "hurto",
            incidentCount: 8,
            level: 3,
            color: "#F97316",
            incidentTypeCount: 8,
            incidentTypeLevel: 3,
            incidentTypeColor: "#F97316",
            incidentTypes: { hurto: 8 },
            lastUpdatedAt: "2026-07-26T12:05:00.000Z",
          },
        ],
      },
    });

    const notifications = page.getByRole("button", {
      name: "1 novedades de datos",
    });
    await expect(notifications).toBeVisible();
    await notifications.click();
    await expect(page.getByText("NOVEDADES DE DATOS")).toBeVisible();
    await expect(
      page.getByText("Actualización de datos agregados", { exact: false }),
    ).toBeVisible();
    expect(backend.googleRequests).toEqual([]);
  });

  test("mantiene sincronizados mapa y hexágonos al alejar y volver a Bogotá", async ({
    isMobile,
    page,
  }) => {
    test.skip(isMobile, "La interacción con rueda se valida en escritorio.");
    const backend = await installMockPlatform(page);

    await page.goto("/");
    await waitForApplication(page);
    await expectMapMatchesLandingHeight(page);
    await page.getByRole("button", { name: "EXPLORAR MAPA" }).click();

    const resolutionValue = page
      .locator("dt", { hasText: "Resolución H3" })
      .locator("xpath=following-sibling::dd[1]");
    const visibleHexagons = page
      .locator("dt", { hasText: "Hexágonos" })
      .locator("xpath=following-sibling::dd[1]");
    await expect(resolutionValue).toHaveText("7");
    await expect(visibleHexagons).not.toHaveText("0");
    const initialVisibleHexagons = await visibleHexagons.textContent();
    await expect.poll(() => requestedHeatmapResolutions(backend)).toContain(7);

    const map = page.getByLabel("Mapa interactivo de Bogotá");
    const bounds = await map.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    for (let step = 0; step < 8; step += 1) {
      await page.mouse.wheel(0, 1_000);
    }

    await expect(resolutionValue).toHaveText("4", { timeout: 15_000 });
    await expect
      .poll(() => requestedHeatmapResolutions(backend), { timeout: 15_000 })
      .toContain(4);
    await expectMapCanvasesAligned(page);

    await page.getByRole("button", { name: "Volver a encuadrar Bogotá" }).click();
    await expect(resolutionValue).toHaveText("7");
    await expect(visibleHexagons).toHaveText(initialVisibleHexagons);
    await expectMapCanvasesAligned(page);
    expect(backend.pageErrors).toEqual([]);
  });

  test("abre una selección compartida mediante el parámetro hex", async ({ page }) => {
    await installMockPlatform(page);

    await page.goto(`/?hex=${HEXAGON_INDEX}`);
    await waitForApplication(page);

    const details = page.getByLabel("Detalles del hexágono seleccionado");
    await expect(details).toBeVisible();
    await expect(details).toContainText(HEXAGON_INDEX);
    await expect(details).toContainText("DATOS DISPONIBLES");
    await expect(details).toContainText("Hurto validado en transporte público");
    await expect(details).toContainText("Promedio de hexágonos vecinos");
    await expect(details).toContainText("Diferencia frente a vecinos");
    await expect(details).toContainText(
      "La validación comunitaria expresa coincidencia entre reportes",
    );
    await expect(
      page.getByRole("heading", { name: "ESTADÍSTICAS DEL HEXÁGONO" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`hex=${HEXAGON_INDEX}`));
    await expect(page).toHaveURL(/period=rolling-year/);

    await details.getByRole("button", { name: "Cerrar detalles" }).click();
    await expect(details).toBeHidden();
    await expect(page).not.toHaveURL(/(?:\?|&)hex=/);
  });

  test("representa datos vacíos sin fabricar incidentes", async ({ page }) => {
    await installMockPlatform(page, { emptyData: true });

    await page.goto("/");
    await waitForApplication(page);

    await expect(
      page
        .getByText("No hay información agregada disponible para este periodo.")
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/0 registros validados en total/)).toBeAttached();
    await expect(page.getByLabel("Leyenda de cantidad de incidentes")).toContainText(
      "Sin registros",
    );
  });

  test("no bloquea la interfaz si una tesela de calles no está disponible", async ({
    page,
  }) => {
    const backend = await installMockPlatform(page, {
      mapTilesUnavailable: true,
    });

    await page.goto("/");
    await waitForApplication(page);

    await expect(page.getByLabel("Mapa interactivo de Bogotá")).toBeVisible();
    await expect
      .poll(() => backend.mapTileRequests.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect(page.getByText("MODO DE RECUPERACIÓN")).toBeHidden();
  });
});
