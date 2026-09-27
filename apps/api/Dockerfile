# The API: the same Worker code, run by wrangler dev on workerd (the Workers runtime), with D1 persisted to /data.
FROM node:22-bookworm-slim
# workerd verifies TLS against the system trust store, unlike Node's bundled CAs.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV WRANGLER_SEND_METRICS=false \
    NODE_ENV=development \
    CI=true

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci -w @lhhp/api -w @lhhp/shared --no-audit --no-fund

COPY packages ./packages
COPY apps/api ./apps/api
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 8787
ENTRYPOINT ["api-entrypoint.sh"]
CMD ["serve"]
