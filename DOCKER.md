# Talk to Learn - Docker Deployment

## Build und Start

```bash
# Build Docker Image
docker-compose build

# Start Container
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Stoppen
docker-compose down
```

## Wichtig

Stelle sicher, dass `.env.local` mit deinem OpenAI API Key existiert:

```
OPENAI_API_KEY=your_api_key_here
```

Die App läuft dann auf http://localhost:8083
