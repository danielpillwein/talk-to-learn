# Talk to Learn

Ein Voice-basiertes Lerntool für Prüfungsvorbereitung. Stelle Fragen aus einem CSV-File, nimm deine Antworten per Mikrofon auf, und erhalte eine KI-Bewertung mit GPT-4o-mini.

## Features

- 📝 **CSV-basierte Fragen**: Lade Fragen aus `data/Anki_Übungstest_2.csv`
- 🎤 **Voice Recording**: Nimm deine Antworten direkt im Browser auf
- 🤖 **KI-Bewertung**: Whisper transkribiert, GPT-4o-mini bewertet
- 📊 **Sofortiges Feedback**: Score (0-10), Feedback, Vergleich mit Musterantwort
- ⚡ **Next.js 14**: Modern, schnell, TypeScript

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. OpenAI API Key konfigurieren

Erstelle eine `.env.local` Datei:

```bash
OPENAI_API_KEY=dein_api_key_hier
```

### 3. Development Server starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## CSV Format

Die Datei `data/Anki_Übungstest_2.csv` muss folgendes Format haben:

- **Delimiter**: Semikolon (`;`)
- **Keine Header-Zeile**
- **Spalte 0**: Frage
- **Spalte 1**: Musterantwort

Beispiel:
```
Was ist ein geordnetes Paar \( (a,b) \)?;Eine Zusammenfassung zweier Elemente, bei der die Reihenfolge wesentlich ist.
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Shadcn UI + Tailwind CSS
- **AI**: OpenAI SDK (Whisper + GPT-4o-mini)
- **Data**: PapaParse (CSV parsing)
- **Icons**: Lucide React

## Projekt-Struktur

```
├── app/
│   ├── api/evaluate/route.ts    # API Route für Whisper + GPT-4o-mini
│   ├── layout.tsx               # Root Layout
│   ├── page.tsx                 # Main UI (Fragen, Recording, Ergebnisse)
│   └── globals.css              # Tailwind + Shadcn Styles
├── lib/
│   ├── data.ts                  # CSV Parsing & Caching
│   └── utils.ts                 # cn() Helper
├── data/
│   └── Anki_Übungstest_2.csv    # Fragen & Musterantworten
└── components/ui/               # Shadcn Components
```

## Verwendung

1. **Frage lesen** → im UI angezeigt
2. **"Aufnahme starten"** klicken → Mikrofon-Zugriff erlauben
3. **Antwort sprechen**
4. **"Aufnahme beenden"** klicken
5. **Warten** → Whisper transkribiert, GPT-4o-mini bewertet
6. **Ergebnis ansehen**:
   - Score (0-10)
   - Feedback-Satz
   - Dein Transkript
   - Musterantwort
7. **"Nächste Frage"** oder **"Nochmal versuchen"**

## Build für Production

```bash
npm run build
npm start
```

## Lizenz

MIT