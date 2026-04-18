# Dockerfile for Fly.io / any container host
# Multi-stage: build deps, then slim runtime with only what we need.

FROM node:20-slim AS build

WORKDIR /app

# System deps Chromium needs at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg wget \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# Install Chromium via Playwright (into the final image location)
RUN npx playwright install chromium

FROM node:20-slim

WORKDIR /app

# Runtime deps for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Copy app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./

# Copy Playwright's browser cache (installed during build)
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

ENV NODE_ENV=production
ENV PORT=3535
EXPOSE 3535

# /data is where the Fly volume is mounted; symlink .promptomate + tests into it
# so generated specs and run history survive redeploys.
RUN mkdir -p /data
CMD ["sh", "-c", "mkdir -p /data/.promptomate /data/tests && ln -sfn /data/.promptomate ./.promptomate && ln -sfn /data/tests ./tests && node dist/cli.js serve"]
