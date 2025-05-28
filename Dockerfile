FROM node:22-slim

# Playwright runtime libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
      libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
      libxdamage1 libxrandr2 libxshmfence1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm i -g playwright && playwright install chromium

WORKDIR /home/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node","src/app.js"]


