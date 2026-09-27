# The database tier: D1 is SQLite. This container shares the D1 volume and serves a read-only SQL browser.
FROM python:3.12-slim
RUN pip install --no-cache-dir "sqlite-web==0.6.*"
COPY docker/db/start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8081
CMD ["/start.sh"]
