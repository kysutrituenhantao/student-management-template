FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci -w @lhhp/e2e --no-audit --no-fund
COPY e2e ./e2e
WORKDIR /app/e2e
CMD ["npx", "playwright", "test"]
