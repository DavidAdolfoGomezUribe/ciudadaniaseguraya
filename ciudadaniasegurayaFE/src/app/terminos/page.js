export const metadata = {
  title: "Términos",
  description: "Condiciones de uso de Ciudadanía Segura Ya.",
};

export default function TermsPage() {
  return (
    <article className="page-grid max-w-4xl py-14">
      <p className="technical-label">DOCUMENTO · TÉRMINOS</p>
      <h1 className="mt-3 text-4xl">Términos de uso</h1>
      <div className="system-panel mt-8 space-y-5 p-6 leading-7">
        <p>
          La plataforma presenta registros validados disponibles durante un periodo
          determinado. No certifica el estado absoluto de una zona ni sustituye
          información oficial, una denuncia o un servicio de emergencia.
        </p>
        <p>
          Quien reporta debe actuar de buena fe, describir hechos de forma respetuosa y
          evitar publicar identidades, acusaciones no verificadas o datos personales de
          terceros.
        </p>
        <p>
          Los reportes ciudadanos permanecen pendientes hasta que el proceso de
          coincidencia y validación comunitaria o administrativa permita incorporarlos a
          las estadísticas públicas.
        </p>
        <p>
          Los enlaces externos se ofrecen como referencias. Cada sitio conserva sus
          propios términos, disponibilidad y responsabilidad editorial.
        </p>
      </div>
    </article>
  );
}
