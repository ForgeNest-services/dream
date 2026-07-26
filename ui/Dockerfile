FROM nginx:alpine

# Copy the nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files
COPY dist /usr/share/nginx/html
COPY index.html /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
