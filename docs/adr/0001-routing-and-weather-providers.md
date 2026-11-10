# 0001. Routing, geocoding and weather providers

Status: accepted

## Context
The brief allows third-party APIs for routing, geocoding and weather, and the project must run on free services only.

## Decision
- Routing and geocoding: OpenRouteService (free API key). Routing uses the `driving-hgv` truck profile with `alternative_routes` (target 3) and the load weight as a weight restriction; place search uses its autocomplete geocoder.
- Weather: Open-Meteo hourly forecast (`wind_speed_10m`, `rain`, `snowfall`), no API key.
- Both sit behind `typing.Protocol` ports in `providers/ports.py`, so a provider can be replaced by writing one adapter.

## Alternate routes beyond 100 km
OpenRouteService refuses `alternative_routes` for trips over 100 km (verified: "approximated route distance must not be greater than 100000.0 meters"), and nearly every truck trip is longer. So `SupplementedRouting` uses ORS as the primary source and tops up to three routes with alternates from Valhalla (`costing=truck`, `alternates=2`, public OSM instance, configurable base URL). A Valhalla route that overlaps a kept route by 90% or more (within 1 mile) is the same road and is dropped. If Valhalla fails, the ORS routes are still returned; if ORS is unavailable or rate limited, Valhalla serves the whole request. Where no genuinely different road exists (for example Dallas to Houston) the user sees fewer than three routes.

## Consequences
- ORS's free tier allows roughly 2,000 requests a day, so the app makes one ORS directions call per plan, caches routes (1 h), geocoding (24 h) and weather (30 min), and throttles the API.
- The public Valhalla instance is a shared fair-use service with no SLA; its failure degrades the result to the ORS routes instead of failing the request.
- Swapping a provider means writing one adapter behind the ports in `providers/ports.py`.
