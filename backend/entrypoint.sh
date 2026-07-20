#!/usr/bin/env sh
set -e

# Wait for the database to accept connections (PostgreSQL in production)
if [ -n "$POSTGRES_DB" ]; then
    echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
    python <<'PY'
import os, time, socket
host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("Database is up.")
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Database not reachable, giving up.")
PY
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Ensuring payment schedules (django-q2)..."
# Idempotent : crée les planifications réconciliation/alerte si absentes. Non
# bloquant — un souci ici ne doit pas empêcher le démarrage du serveur.
python manage.py setup_payment_crons || echo "setup_payment_crons a échoué (non bloquant)."

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec "$@"
