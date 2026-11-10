"""Settings shared by every environment. Configuration comes from the environment (12-factor)."""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY: str = env("DJANGO_SECRET_KEY")
DEBUG: bool = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS: list[str] = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "apps.trips",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.trips.api.middleware.RequestIdMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

# The service is stateless: weather and route data are never persisted.
DATABASES: dict[str, dict[str, str]] = {}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# The built React app (copied here by build.sh). WhiteNoise serves its files from the site root
# (/assets/..., /favicon.svg) and the `spa` view serves index.html for every page route.
FRONTEND_DIST = BASE_DIR / "frontend_dist"
if FRONTEND_DIST.exists():
    WHITENOISE_ROOT = FRONTEND_DIST
# Vite fingerprints everything under /assets/, so browsers may cache those files forever.
WHITENOISE_IMMUTABLE_FILE_TEST = lambda _path, url: url.startswith("/assets/")  # noqa: E731

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "safehaul",
    }
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "geocode": env("THROTTLE_GEOCODE", default="60/min"),
        "plan": env("THROTTLE_PLAN", default="10/min"),
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.trips.api.errors.api_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SafeHaul API",
    "DESCRIPTION": "Weather-aware truck route planning.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Third-party services. Both are free tiers (OpenRouteService is limited to roughly 2,000
# requests a day), so timeouts, retries, caching and throttling protect the quota.
ORS_API_KEY: str = env("ORS_API_KEY", default="")
ORS_BASE_URL: str = env("ORS_BASE_URL", default="https://api.openrouteservice.org")
# Supplies alternate routes where ORS will not (trips over 100 km). Can be self-hosted.
VALHALLA_BASE_URL: str = env("VALHALLA_BASE_URL", default="https://valhalla1.openstreetmap.de")
OPEN_METEO_BASE_URL: str = env("OPEN_METEO_BASE_URL", default="https://api.open-meteo.com")
HTTP_USER_AGENT: str = env("HTTP_USER_AGENT", default="SafeHaul/1.0 (truck weather routing)")
HTTP_TIMEOUT_SECONDS: float = env.float("HTTP_TIMEOUT_SECONDS", default=20.0)
ROUTE_CACHE_TTL: int = env.int("ROUTE_CACHE_TTL", default=3_600)
GEOCODE_CACHE_TTL: int = env.int("GEOCODE_CACHE_TTL", default=86_400)
WEATHER_CACHE_TTL: int = env.int("WEATHER_CACHE_TTL", default=1_800)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "apps.trips.api.middleware.RequestIdFilter"}},
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_id"],
        }
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
}
