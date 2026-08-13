FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

# VITE_API_URL is baked into the client bundle at build time (import.meta.env),
# so it must be passed as a build arg, not a runtime env var.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN bun run build

FROM oven/bun:1-alpine AS runtime

RUN apk add --no-cache nginx

WORKDIR /app

# Nitro's server bundle externalizes some packages (e.g. react-dom/server)
# rather than inlining them, so node_modules must be present at runtime too.
COPY package.json bun.lock* ./
RUN bun install --production

COPY --from=build /app/dist ./dist
COPY nginx.conf /etc/nginx/http.d/default.conf

ENV NODE_ENV=production
ENV HOST=127.0.0.1
ENV PORT=3004
EXPOSE 80

# nginx serves static assets from dist/client and reverse-proxies everything
# else to the Bun/Nitro SSR server on 127.0.0.1:3004 (internal only — nginx
# is the sole public-facing process, matching the ui/ service's pattern).
CMD ["sh", "-c", "bun run dist/server/server.js & exec nginx -g 'daemon off;'"]
