"""Serves the built React app for every page route, so /plan loads directly and on refresh."""

from django.conf import settings
from django.http import HttpRequest, HttpResponse

NOT_BUILT = (
    "The frontend has not been built. In development, run the Vite dev server "
    "(npm run dev in frontend/) and open http://localhost:5173. In production, build.sh builds it."
)


def spa(request: HttpRequest, path: str = "") -> HttpResponse:
    # A path with a file extension is a missing asset, not a page: answer 404, not the app shell.
    if "." in path.rsplit("/", 1)[-1]:
        return HttpResponse("Not found", status=404, content_type="text/plain")
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        return HttpResponse(NOT_BUILT, status=404, content_type="text/plain")
    response = HttpResponse(index.read_bytes(), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = (
        "no-cache"  # always fetch the latest shell; assets are fingerprinted
    )
    return response
