# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

# Python runtime tuning
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps: build tools for wheels + libpq for psycopg + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Application code
COPY . .

# Non-root runtime user; owns writable dirs for static/media
RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /app/staticfiles /app/mediafiles \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# collectstatic + migrate run at startup (env vars available then)
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "Algomaat.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
