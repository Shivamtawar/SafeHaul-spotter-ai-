"""Production settings. Every security option is on; secrets come from the environment."""

from .base import *  # noqa: F403

DEBUG = False

# Render provides the service hostname; trust it automatically alongside DJANGO_ALLOWED_HOSTS.
_render_host = env("RENDER_EXTERNAL_HOSTNAME", default="")  # noqa: F405
if _render_host:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_host]  # noqa: F405

if not ORS_API_KEY:  # noqa: F405
    raise RuntimeError("ORS_API_KEY must be set in production")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SSL_REDIRECT", default=True)  # noqa: F405
SECURE_REDIRECT_EXEMPT = [r"^healthz$"]
SECURE_HSTS_SECONDS = 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
