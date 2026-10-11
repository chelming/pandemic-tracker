# Pandemic S2 — Infection Tracker

Shared real-time tracker for Pandemic Season 2. All players on the same network
see updates instantly via WebSocket. State persists across restarts via Docker volume.

## Quick start (local)

```bash
npm install
node server.js
# open http://localhost:3000
```

## Docker

A GitHub Action builds and pushes `ghcr.io/chelming/pandemic-tracker` on every push
to `main` (tags: `latest` and `sha-<commit>`). To run it behind Traefik:

```bash
cp .env.example .env     # set PANDEMIC_HOST at minimum
docker compose up -d
```

If the package is private, `docker login ghcr.io` first (or make the package public).

### docker-compose.yml

```yaml
services:
  pandemic-tracker:
    image: ghcr.io/chelming/pandemic-tracker:${TAG:-latest}
    container_name: pandemic-tracker
    restart: unless-stopped
    volumes:
      - pandemic_data:/data
    environment:
      - PORT=${PORT:-3000}
      - STATE_FILE=${STATE_FILE:-/data/state.json}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.pandemic.rule=Host(`${PANDEMIC_HOST}`)"
      - "traefik.http.routers.pandemic.entrypoints=${TRAEFIK_ENTRYPOINT:-websecure}"
      - "traefik.http.routers.pandemic.tls.certresolver=${TRAEFIK_CERTRESOLVER:-letsencrypt}"
      - "traefik.http.services.pandemic.loadbalancer.server.port=${PORT:-3000}"
      # WebSocket support — required for live sync
      - "traefik.http.middlewares.pandemic-ws.headers.customrequestheaders.X-Forwarded-Proto=https"
      - "traefik.http.routers.pandemic.middlewares=pandemic-ws"
    networks:
      - traefik

volumes:
  pandemic_data:

networks:
  traefik:
    name: ${TRAEFIK_NETWORK:-traefik_proxy}
    external: true
```
### Environment variables

Set these in `.env` next to the compose file:

| Variable | Default | Purpose |
|---|---|---|
| `PANDEMIC_HOST` | required | Hostname Traefik routes to the app |
| `TAG` | `latest` | Image tag to run |
| `TRAEFIK_NETWORK` | `traefik_proxy` | Name of your external Traefik network (`docker network ls`) |
| `TRAEFIK_ENTRYPOINT` | `websecure` | Traefik entrypoint |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` | Traefik cert resolver |
| `PORT` | `3000` | Port the app listens on |
| `STATE_FILE` | `/data/state.json` | Where state is persisted in the container |

Example `.env`:

```ini
# Image tag to run (latest, or a sha-<commit> tag)
TAG=latest
# Hostname Traefik routes to this app (required)
PANDEMIC_HOST=pandemic.example.com
# Traefik settings
TRAEFIK_NETWORK=traefik_proxy
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=letsencrypt
# App
PORT=3000
STATE_FILE=/data/state.json
```
## How state persists

- Live: WebSocket broadcasts every change to all connected clients immediately
- On disk: every change is written to `/data/state.json` inside the container
- The `pandemic_data` Docker volume maps that file to the host — survives
  container restarts, rebuilds, and `docker compose down` (but NOT `docker compose down -v`)

## Notes

- `wss://` is used automatically when served over HTTPS (Traefik + Let's Encrypt)
- The connection status indicator at the top shows green/yellow/red and auto-reconnects
  if the connection drops
- Traefik handles WebSocket upgrade transparently — no extra config needed beyond
  the included labels
