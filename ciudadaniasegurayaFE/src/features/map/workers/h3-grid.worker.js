import { generateH3Grid } from "../utils/h3-grid";

self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      ok: true,
      ...generateH3Grid(data),
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo generar H3",
    });
  }
};
