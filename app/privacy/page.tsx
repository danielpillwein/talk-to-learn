import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Datenschutz – Talk to Learn",
  description: "Datenschutzerklärung von Talk to Learn",
};

export default function PrivacyPage(): JSX.Element {
  return (
    <LegalPageLayout title="Datenschutzerklärung">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Verantwortlicher</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Talk to Learn
          <br />
          Daniel Pillwein
          <br />
          Mollardgasse 77/1/25
          <br />
          E-Mail:{" "}
          <a className="underline hover:text-foreground" href="mailto:daniel@pillwein.at">
            daniel@pillwein.at
          </a>
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Erhebung und Verarbeitung personenbezogener Daten</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Bei der Nutzung dieser Plattform können personenbezogene Daten verarbeitet werden, insbesondere:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground md:text-base">
          <li>Accountdaten (z. B. E-Mail-Adresse)</li>
          <li>hochgeladene Lernunterlagen</li>
          <li>Audioaufnahmen von Antworten</li>
          <li>Nutzungsdaten der Plattform</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Diese Daten werden ausschließlich zur Bereitstellung und Verbesserung der Plattform verarbeitet.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Zweck der Verarbeitung</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">Die Verarbeitung erfolgt zur:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground md:text-base">
          <li>Bereitstellung der Lernplattform</li>
          <li>Generierung von Lernfragen aus hochgeladenen Inhalten</li>
          <li>Analyse von Audioantworten zur Lernunterstützung</li>
          <li>Verbesserung der Servicequalität</li>
        </ul>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Drittanbieter</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Zur Bereitstellung bestimmter Funktionen können externe Dienste verwendet werden, z. B.:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground md:text-base">
          <li>KI-Analyse von Antworten</li>
          <li>Zahlungsabwicklung über Stripe</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Diese Anbieter verarbeiten Daten ausschließlich im Rahmen der jeweiligen Dienste.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Speicherdauer</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Personenbezogene Daten werden nur so lange gespeichert, wie es für die Bereitstellung der Plattform und
          gesetzliche Verpflichtungen erforderlich ist.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Rechte der Nutzer</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">Nutzer haben das Recht auf:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground md:text-base">
          <li>Auskunft über gespeicherte Daten</li>
          <li>Berichtigung</li>
          <li>Löschung</li>
          <li>Einschränkung der Verarbeitung</li>
          <li>Datenübertragbarkeit</li>
        </ul>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Kontakt Datenschutz</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Bei Fragen zum Datenschutz wenden Sie sich an:
          <br />
          <a className="underline hover:text-foreground" href="mailto:daniel@pillwein.at">
            daniel@pillwein.at
          </a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
