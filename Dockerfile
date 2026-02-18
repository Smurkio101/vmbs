FROM node:22-slim

WORKDIR /home/app

# Copy package files first (to leverage Docker caching)
COPY package*.json ./

# Install npm dependencies (including Playwright)
RUN npm ci --omit=dev

# Install Chromium browser and all required system libraries
RUN npx playwright install chromium --with-deps

# Copy the rest of the application
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/app.js"]


