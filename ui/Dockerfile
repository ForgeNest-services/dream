FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY src ./src
COPY fonts ./fonts
COPY *.html ./
COPY blog ./blog
COPY public ./public

RUN npx @tailwindcss/cli -i ./src/input.css -o ./dist/output.css --minify

FROM nginx:alpine

# Copy the nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets (JS lives in dist/ alongside the built CSS; not part of the
# Tailwind build itself, so copy it straight from source)
COPY dist/index.js /usr/share/nginx/html/dist/index.js
COPY public /usr/share/nginx/html/public
COPY fonts /usr/share/nginx/html/fonts
COPY *.html /usr/share/nginx/html/
# *.html above only matches root-level pages — blog posts live one
# directory deeper (blog/*.html) and need their own explicit copy.
COPY blog /usr/share/nginx/html/blog
COPY robots.txt sitemap.xml /usr/share/nginx/html/

# CSS built in the previous stage — always fresh, never stale
COPY --from=build /app/dist/output.css /usr/share/nginx/html/dist/output.css

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
