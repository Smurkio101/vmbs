FROM node:22-slim

# ---------- Playwright & all browser deps ----------
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    npx playwright install-deps && \
    rm -rf /var/lib/apt/lists/*

# install Playwright binaries once
RUN npm i -g playwright && playwright install chromium


WORKDIR /home/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node","src/app.js"]


