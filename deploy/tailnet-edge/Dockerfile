FROM caddy:2-alpine

RUN apk add --no-cache curl

COPY entrypoint.sh /usr/local/bin/sage-router-edge-entrypoint
RUN chmod +x /usr/local/bin/sage-router-edge-entrypoint

ENTRYPOINT ["/usr/local/bin/sage-router-edge-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
