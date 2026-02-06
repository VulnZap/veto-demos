# Veto Demo — Live Desktop Agent Sandbox

Watch an AI agent control a real browser on a Linux desktop in real-time, with every action validated by Veto. When Veto blocks a dangerous action (navigating to banking sites, typing credit card numbers, clicking "Buy Now"), the agent pauses and you decide — approve or deny.

## What you need

- **Veto API key** — get one at [runveto.com](https://runveto.com)
- **Model provider token** — set `MODEL_PROVIDER_TOKEN` in `backend/.env` (or use `ANTHROPIC_API_KEY` / `VERTEX_API_KEY`)

## Quick start (Docker)

```bash
docker compose up --build
```

Open [localhost:8080](http://localhost:8080), enter your Veto API key, choose Claude Sonnet 4.5 or Opus 4.5, pick a task, hit Start. You'll see a live desktop stream with the agent working and Veto intercepting every action.

## Deploy to GCP

```bash
cd infra
./deploy.sh
```

Creates a Compute Engine VM, pushes the Docker image to Artifact Registry, and prints the public URL. Tear down with the command shown in the output.

## Local development

Terminal 1 — start desktop + VNC + backend:

```bash
# Start Xvfb virtual display
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99

# Start VNC
x11vnc -display :99 -forever -nopw -rfbport 5900 &
websockify --web /usr/share/novnc 6080 localhost:5900 &

# Start backend
cd backend
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). Vite proxies `/api`, `/ws`, and `/vnc` to the backend.

## Architecture

```
User → React UI (:5173/8080)
         │
         ├── /vnc → noVNC → websockify → x11vnc → Xvfb (:99)
         │                                           │
         │                                    Playwright Chromium
         │                                    (visible, not headless)
         │
         └── /ws → FastAPI WebSocket → Veto decision events
                    │
                    ├── browser-use Agent (Claude Sonnet 4.5 or Opus 4.5)
                    │     └── DemoVetoTools → Veto Python SDK
                    │           └── POST /v1/validate → veto-server
                    │
                    └── Approval flow (asyncio.Event pause/resume)
```

## What the demo shows

1. **Live desktop** — real Linux desktop streamed via VNC, not screenshots
2. **AI browser agent** — Claude Sonnet 4.5 or Opus 4.5 controlling Chromium via browser-use
3. **Veto validation** — every navigate, click, type, search validated against policies in milliseconds
4. **Dramatic interceptions** — red flash on deny, "BLOCKED" stamp, approval card with timer
5. **Human-in-the-loop** — agent pauses on deny, you approve or deny, agent adapts
6. **Live stats** — validation count, allow/deny ratio, avg/min/max latency with sparkline

## Example tasks

- "Search for flights from NYC to Tokyo and find the cheapest option"
- "Go to Amazon and find the best-rated wireless headphones under $100"
- "Research the latest AI safety papers on arxiv.org"
