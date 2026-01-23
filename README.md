# Talk to Learn

Ein Voice-basiertes Lerntool für Prüfungsvorbereitung mit Accounts, KI-gestützter Bewertung und AI-Generierung von Lernsets.

## Features

- 👤 **Accounts (OAuth)**: Login mit Google
- 🎧 **Voice Recording**: Antworten direkt im Browser aufnehmen
- 🤖 **KI-Bewertung**: Whisper transkribiert, GPT-4o-mini bewertet
- 🧠 **AI-Generierung**: Lernsets aus Uploads oder Text erstellen
- 📊 **Fortschritt serverseitig**: Review-Status pro User gespeichert
- ⚡ **Next.js 14**: App Router, TypeScript

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Environment konfigurieren

Erstelle eine `.env` Datei:

```bash
OPENAI_API_KEY=dein_api_key_hier
GROQ_API_KEY=dein_groq_key_hier
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dein_secret
GOOGLE_CLIENT_ID=dein_client_id
GOOGLE_CLIENT_SECRET=dein_client_secret
```

### 3. Development Server starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## Routing

- `/` Landing Page
- `/auth/sign-in` Login
- `/app/learn` Lernsets
- `/app/learn/[id]` Lernflow
- `/app/create` AI-Lernset erstellen
- `/app/account` Account

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Shadcn UI + Tailwind CSS
- **Auth**: NextAuth (Google OAuth)
- **DB**: Prisma + SQLite
- **AI**: OpenAI SDK (Whisper + GPT-4o-mini), Groq (Whisper)
- **PDF**: pdf-parse
- **Icons**: Lucide React

## Projekt-Struktur

```
├── app/
│   ├── api/ai/*                 # AI Extract/Generate/Save
│   ├── api/evaluate/route.ts    # Whisper + GPT-4o-mini
│   ├── app/learn/*              # Lernflow
│   ├── app/create/page.tsx      # AI-Lernset erstellen
│   └── page.tsx                 # Landing
├── lib/
│   ├── db.ts                    # Prisma Client
│   ├── progress.ts              # Serverseitiger Fortschritt
│   └── utils.ts                 # cn() Helper
├── prisma/
│   └── schema.prisma
├── prompts/
│   └── *.md                     # AI Prompts
└── components/ui/               # Shadcn Components
```

## Verwendung

1. **Login** über Google
2. **/app/learn**: Lernset auswählen
3. **Antwort sprechen** → KI bewertet
4. **/app/create**: Neues Lernset mit AI erzeugen

## Build für Production

```bash
npm run build
npm start
```

## Lizenz

MIT
