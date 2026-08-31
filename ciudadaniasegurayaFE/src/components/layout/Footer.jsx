import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--border-primary)] bg-[var(--background-secondary)]">
      <div className="page-grid grid gap-10 py-12 md:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="technical-label mb-3">CONTACTO · CANAL 01</p>
          <h2 className="mb-4 text-2xl font-semibold">Hablemos de la plataforma</h2>
          <p className="max-w-2xl text-[var(--foreground-secondary)]">
            Para consultas, propuestas, correcciones o información relacionada con la
            plataforma, comunícate con el equipo de Ciudadanía Segura Ya.
          </p>
          <ButtonLink
            href="mailto:dav.studios95@gmail.com?subject=Contacto%20Ciudadanía%20Segura%20Ya"
            className="mt-3"
          >
            <Mail size={16} aria-hidden="true" />
            CONTACTARNOS
          </ButtonLink>
          <p className="mt-3 font-mono text-xs">dav.studios95@gmail.com</p>
        </div>
        <div className="border-l border-[var(--border-soft)] pl-6">
          <p className="technical-label mb-3">AVISO DE INFORMACIÓN</p>
          <p className="text-sm text-[var(--foreground-secondary)]">
            Los datos publicados no sustituyen fuentes oficiales, servicios de
            emergencia ni una denuncia ante las autoridades competentes.
          </p>
          <nav aria-label="Información legal" className="mt-5 flex flex-wrap gap-4">
            <Link className="text-sm underline" href="/privacidad">
              Privacidad
            </Link>
            <Link className="text-sm underline" href="/terminos">
              Términos
            </Link>
            <a
              className="inline-flex items-center gap-1 text-sm underline"
              href="https://www.policia.gov.co/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Policía Nacional
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </nav>
        </div>
      </div>
      <div className="border-t border-[var(--border-soft)]">
        <div className="page-grid flex flex-wrap justify-between gap-2 py-4 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">
          <span>© {new Date().getFullYear()} Ciudadanía Segura Ya</span>
          <span>Claridad · Privacidad · Transparencia</span>
        </div>
      </div>
    </footer>
  );
}
