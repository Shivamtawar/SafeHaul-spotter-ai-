# Architecture

## The big picture

```mermaid
flowchart LR
  user([Driver]) --> spa[React app<br/>Vite, TypeScript, Leaflet]
  spa -- "POST /api/v1/plan<br/>GET /api/v1/geocode" --> api[Django API<br/>DRF, gunicorn]
  api --> svc[PlanTripService]
  svc --> routing[Routing port]
  svc --> weather[Weather port]
  routing --> ors[OpenRouteService]
  routing --> valhalla[Valhalla]
  weather --> meteo[Open-Meteo]
  svc --> domain[Domain<br/>risk, ranking, geometry, timing]
```

In production one Render service runs gunicorn. Django serves the API under `/api/v1`, the built React files through WhiteNoise, and `index.html` for every page route, so the browser and the API share one origin.

## One trip, step by step

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API view
  participant S as PlanTripService
  participant R as Routing (ORS + Valhalla)
  participant W as Open-Meteo
  B->>A: POST /plan (origin, destination, departure, load, interval)
  A->>S: validated TripRequest
  S->>R: routes (up to 3, truck profile)
  S->>S: checkpoints every N miles, ETA at each (TravelProfile)
  S->>W: one batched hourly forecast for every checkpoint
  S->>S: risk per checkpoint at its ETA hour, rank routes, 48-hour risk grid
  S-->>A: TripPlan
  A-->>B: routes, checkpoints, warnings, heatmap
```

## Backend layers (`backend/apps/trips`)

Dependencies point inward: `api` -> `services` -> `domain`, and `providers` implement ports that `services` use.

| Layer | Responsibility | Notes |
|---|---|---|
| `domain/` | Risk rules, ranking, geometry, ETA, warnings | Pure Python, no Django or HTTP. Frozen dataclasses. 100% covered, property-tested. |
| `providers/` | Adapters for ORS, Valhalla, Open-Meteo and a shared HTTP client | Timeouts, retries on transient failures, caching, typed errors. `SupplementedRouting` combines ORS with Valhalla alternates. |
| `services/` | `PlanTripService`, the one use case | Dependencies injected, so tests use fakes and never touch the network. |
| `api/` | DRF views, serializers, error envelope, throttling, the SPA fallback | Thin: validate, call the service, shape the response. |

Cross-cutting: one error envelope (`{"error": {"code", "message", "details"}}`), per-request IDs in structured JSON logs, throttling, response caching (routes 1 h, geocoding 24 h, weather 30 min), OpenAPI at `/api/docs/`.

## Frontend (`frontend/src`)

- `app/`: router, providers, error boundary. `features/`: `landing`, `planner`, `trip-form`, `routes`, `map`, `heatmap`. `shared/`: API client (responses validated with zod), risk tokens, formatting, UI.
- The 48-hour heatmap is computed on the server and returned with the plan, so the slider only recolours data already in memory. The overlay is drawn on its own canvas in a dedicated map pane, colour always meaning the risk level.

## Quality gates

`make lint typecheck test e2e audit`: ruff and mypy strict on the backend, TypeScript strict and oxlint on the frontend, pytest with a 90% coverage gate, Vitest, Playwright (desktop and phone, with axe accessibility scans), pip-audit and npm audit. CI runs the same checks (`.github/workflows`).

Decisions and their reasons are in [`docs/adr`](docs/adr).
