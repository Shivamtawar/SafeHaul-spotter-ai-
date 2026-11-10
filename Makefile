.PHONY: install dev-backend dev-frontend lint test e2e format typecheck audit

PY := backend/.venv/bin

install:
	python3 -m venv backend/.venv
	$(PY)/pip install -r backend/requirements/dev.txt
	cd frontend && npm ci

dev-backend:
	cd backend && .venv/bin/python manage.py runserver

dev-frontend:
	cd frontend && npm run dev

lint:
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run lint && npm run format:check

typecheck:
	cd backend && .venv/bin/mypy
	cd frontend && npm run typecheck

test:
	cd backend && .venv/bin/pytest --cov
	cd frontend && npm test

format:
	cd backend && .venv/bin/ruff check --fix . && .venv/bin/ruff format .
	cd frontend && npm run format

e2e:
	cd frontend && npm run test:e2e

audit:
	cd backend && .venv/bin/pip-audit -r requirements/base.txt
	cd frontend && npm audit --audit-level=high
