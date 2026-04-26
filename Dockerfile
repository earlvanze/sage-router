FROM node:22-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8788 \
    SAGE_ROUTER_HOME=/config

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @askalf/dario

WORKDIR /app
COPY router.py provider-profiles.json openclaw_gateway_agent.mjs requirements.txt ./
COPY scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /app/router.py

EXPOSE 8788 3456
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD python3 -c "import urllib.request, os; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8788'), timeout=5)"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["python3", "/app/router.py"]
