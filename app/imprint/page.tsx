import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Impressum & AGB – Talk to Learn",
  description: "Impressum und Allgemeine Geschäftsbedingungen von Talk to Learn",
};

export default function ImprintPage(): JSX.Element {
  return (
    <LegalPageLayout title="Impressum & AGB">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Anbieter</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Talk to Learn
          <br />
          Daniel Pillwein
          <br />
          Mollardgasse 77/1/25
          <br />
          Österreich
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          E-Mail:{" "}
          <a className="underline hover:text-foreground" href="mailto:daniel@pillwein.at">
            daniel@pillwein.at
          </a>
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Verantwortlich für den Inhalt</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Daniel Pillwein
          <br />
          Mollardgasse 77/1/25
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Unternehmensgegenstand</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Bereitstellung einer webbasierten Lernplattform zur Generierung von Lernfragen aus Nutzerunterlagen sowie
          zur Analyse mündlicher Antworten mittels künstlicher Intelligenz.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Allgemeine Geschäftsbedingungen (AGB)</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Diese AGB gelten für die Nutzung der Plattform Talk to Learn sowie für alle kostenpflichtigen Abonnements.
          Abweichende Bedingungen der Nutzer gelten nur, wenn sie ausdrücklich schriftlich bestätigt wurden.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Vertragsschluss</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Ein Vertrag über ein kostenpflichtiges Abo kommt zustande, sobald der Zahlungsvorgang im Stripe Checkout
          erfolgreich abgeschlossen wurde. Die jeweils gewählte Laufzeit (monatlich oder jährlich) und der Preis werden
          vor Abschluss der Bestellung angezeigt.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Leistungsbereitstellung</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Talk to Learn ist eine digitale Dienstleistung. Der Zugang zu den Funktionen wird nach erfolgreicher Zahlung
          in der Regel unmittelbar freigeschaltet.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Preise, Rabatte und Abrechnung</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Alle Preise werden in Euro angezeigt. Die Abrechnung erfolgt je nach gewähltem Plan monatlich oder jährlich
          im Voraus. Aktionspreise und Rabatte (z. B. Jahresrabatt) werden im Checkout ausgewiesen und gelten nur für
          den dort angegebenen Zeitraum. Rabatte sind nicht kombinierbar, sofern nicht ausdrücklich anders angegeben.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Zahlungsmethoden</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Die Zahlungsabwicklung erfolgt über Stripe. Akzeptiert werden die im Checkout angezeigten Zahlungsmethoden,
          insbesondere Kredit- und Debitkarten (z. B. Visa, Mastercard, American Express) sowie gegebenenfalls weitere
          von Stripe bereitgestellte Methoden.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Laufzeit und Kündigung</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Kostenpflichtige Abos verlängern sich automatisch um den gewählten Abrechnungszeitraum, sofern sie nicht vor
          Ende der laufenden Periode gekündigt werden. Eine Kündigung ist jederzeit zum Ende der aktuellen
          Abrechnungsperiode möglich.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Widerruf und Rückerstattung</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Da es sich um eine digitale Dienstleistung handelt, wird die Leistung unmittelbar nach Kauf bereitgestellt.
          Bereits bezahlte Zeiträume werden grundsätzlich nicht anteilig erstattet, außer es besteht eine zwingende
          gesetzliche Verpflichtung. Bei fehlerhaften Abbuchungen oder Doppelzahlungen kontaktiere uns bitte unter{" "}
          <a className="underline hover:text-foreground" href="mailto:daniel@pillwein.at">
            daniel@pillwein.at
          </a>
          .
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Haftungsausschluss</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.
        </p>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Urheberrecht</h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem Urheberrecht.
        </p>
      </section>
    </LegalPageLayout>
  );
}
