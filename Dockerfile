# ---------- base image ----------
FROM node:22-slim

# ---------- Playwright libs ----------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
        libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
        libxdamage1 libxrandr2 libxshmfence1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# ---------- install Playwright + Chromium once ----------
RUN npm i -g playwright && playwright install chromium

# ---------- non-root user ----------
RUN useradd -m app
USER app
WORKDIR /home/app

# ---------- install app deps ----------
COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev

# ---------- copy source ----------
COPY --chown=app:app . .

ENV PORT=3001     
EXPOSE 3001

# ---------- start both Node servers ----------
CMD ["sh", "-c", "node server.js & node index.cjs"]
