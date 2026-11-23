# Depot-Kompass Desktop - lokal fuer Linux und Windows (Docker Desktop). Nur Python + cryptography.
FROM python:3.13-alpine
RUN pip install --no-cache-dir cryptography==50.0.2 && adduser -D -u 1000 kompass
WORKDIR /app
COPY server.py desktop_bruecke.js /app/
ENV IM_CONTAINER=1 ASSETS=/app/assets DATEN=/daten PORT=8098
USER kompass
EXPOSE 8098
CMD ["python3", "/app/server.py"]
