# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Full desktop sandbox
FROM python:3.12-slim
WORKDIR /app

# System deps: Xvfb, VNC, noVNC, websockify, supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    supervisor \
    wget \
    curl \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

# Install Caddy via apt
RUN apt-get update && \
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https && \
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \
    apt-get update && \
    apt-get install -y caddy && \
    rm -rf /var/lib/apt/lists/*

# Python deps + Veto SDK from PyPI + Playwright Chromium
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt veto==0.2.0 && \
    python -m playwright install chromium && \
    python -m playwright install-deps chromium

# Copy backend
COPY backend/ .

# Copy infra configs
COPY infra/ ./infra/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./static/

# Create directories
RUN mkdir -p /var/log/supervisor /data/caddy

EXPOSE 80 443

ENTRYPOINT ["/app/infra/entry.sh"]
