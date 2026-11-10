#!/usr/bin/env bash
# Builds SafeHaul for Render: the React frontend, then the Django backend that serves it.
# Run from the repository root. Safe to run repeatedly.
set -o errexit -o nounset -o pipefail

NODE_VERSION="22.14.0"

echo "==> Checking for Node.js"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js not found; installing ${NODE_VERSION}"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "${HOME}"
  export PATH="${HOME}/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"
fi
node --version

echo "==> Building the frontend"
(cd frontend && npm ci --include=dev && npm run build)

echo "==> Installing the backend"
pip install --no-cache-dir -r backend/requirements/base.txt

echo "==> Copying the frontend build into the backend"
rm -rf backend/frontend_dist
cp -R frontend/dist backend/frontend_dist

echo "==> Collecting static files"
# Dev settings need no production secrets, so the build never depends on them.
(cd backend && DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-build-only}" \
  python manage.py collectstatic --no-input --settings=config.settings.dev)

echo "==> Build complete"
