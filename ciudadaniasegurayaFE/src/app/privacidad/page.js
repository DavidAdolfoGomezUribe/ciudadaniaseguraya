export const metadata = {
  title: "Privacidad",
  description: "Principios de privacidad de Ciudadanía Segura Ya.",
};

export default function PrivacyPage() {
  return (
    <article className="page-grid max-w-4xl py-14">
      <p className="technical-label">DOCUMENTO · PRIVACIDAD</p>
      <h1 className="mt-3 text-4xl">Aviso de privacidad</h1>
      <div className="system-panel mt-8 space-y-5 p-6 leading-7">
        <p>
          Ciudadanía Segura Ya procesa los datos de cuenta indispensables para
          identificar aportes y reducir reportes duplicados. La identidad, correo y
          ubicación actual del reportante no se publican en el mapa.
        </p>
        <p>
          Las ubicaciones de incidentes sensibles se representan mediante áreas H3
          aproximadas. La ubicación del navegador solo se solicita mediante una acción
          explícita y no se envía hasta que la persona confirme que corresponde al
          incidente.
        </p>
        <p>
          La caché persistente del navegador contiene exclusivamente datos públicos del
          mapa, catálogos y estadísticas. Contraseñas, access tokens, refresh tokens y
          datos privados no se guardan en IndexedDB ni en almacenamiento web.
        </p>
        <p>
          Para solicitudes de acceso, corrección o eliminación, escribe a{" "}
          <a className="underline" href="mailto:dav.studios95@gmail.com">
            dav.studios95@gmail.com
          </a>
          .
        </p>
      </div>
    </article>
  );
}
