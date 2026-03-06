# Talk to Learn - Docker Deployment

## 1) Vorbereiten

```bash
cp .env.example .env
```

Danach in `.env` mindestens die benoetigten Werte setzen (API Keys, Auth, ggf. DB).

## 2) Build + Start

Empfohlen:

```bash
./docker.sh up
```

Alternative ohne Skript:

```bash
docker compose build
docker compose up -d
```

## 3) Betrieb

```bash
# Logs
./docker.sh logs

# Neustart mit neuem Build
./docker.sh restart

# Stoppen
./docker.sh down
```

## Hinweise

- Die App lauscht im Container auf Port `8083`.
- Standard-Mapping ist `${PORT:-8083}:8083`.
- Fuer SQLite wird standardmaessig ein persistentes Volume verwendet (`talk_to_learn_data`),
  falls `DATABASE_URL` nicht gesetzt ist.
