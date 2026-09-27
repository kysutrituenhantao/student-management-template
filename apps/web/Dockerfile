# The frontend: build the static export, then serve it the way Workers static assets would.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci -w @lhhp/web -w @lhhp/shared --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY docker/headers-to-nginx.mjs ./docker/

ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build -w @lhhp/web && node docker/headers-to-nginx.mjs apps/web/out/_headers > /tmp/headers.conf

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /tmp/headers.conf /etc/nginx/snippets/headers.conf
COPY --from=build /app/apps/web/out /usr/share/nginx/html
EXPOSE 80
