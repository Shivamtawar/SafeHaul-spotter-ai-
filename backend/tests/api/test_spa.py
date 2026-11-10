from pathlib import Path

import pytest
from pytest_django import Settings
from rest_framework.test import APIClient

INDEX = "<!doctype html><title>SafeHaul</title><div id=root></div>"


@pytest.fixture
def built_frontend(tmp_path: Path, settings: Settings) -> Path:
    (tmp_path / "index.html").write_text(INDEX)
    settings.FRONTEND_DIST = tmp_path
    return tmp_path


@pytest.mark.parametrize("path", ["/", "/plan", "/plan/", "/some/deep/page"])
def test_every_page_route_serves_the_app_shell(built_frontend: Path, path: str) -> None:
    response = APIClient().get(path)
    assert response.status_code == 200
    assert response["Content-Type"] == "text/html; charset=utf-8"
    assert response.content.decode() == INDEX


def test_the_shell_is_never_cached(built_frontend: Path) -> None:
    assert APIClient().get("/plan")["Cache-Control"] == "no-cache"


@pytest.mark.parametrize("path", ["/assets/missing.js", "/robots.txt", "/a/b/photo.png"])
def test_a_missing_file_is_a_404_not_the_app(built_frontend: Path, path: str) -> None:
    response = APIClient().get(path)
    assert response.status_code == 404
    assert INDEX not in response.content.decode()


def test_the_api_is_not_swallowed_by_the_catch_all(built_frontend: Path) -> None:
    assert APIClient().get("/healthz").json() == {"status": "ok"}
    assert APIClient().get("/api/schema/").status_code == 200
    assert APIClient().get("/api/v1/plan").status_code == 405


def test_an_unknown_api_path_is_not_the_app(built_frontend: Path) -> None:
    response = APIClient().get("/api/v1/nope")
    assert response.status_code == 404
    assert INDEX not in response.content.decode()


def test_without_a_build_the_page_says_how_to_run_the_frontend(
    tmp_path: Path, settings: Settings
) -> None:
    settings.FRONTEND_DIST = tmp_path  # no index.html inside
    response = APIClient().get("/plan")
    assert response.status_code == 404
    assert "npm run dev" in response.content.decode()


def test_cross_site_requests_such_as_map_tiles_carry_the_sites_origin(built_frontend: Path) -> None:
    # OpenStreetMap blocks tile requests without a Referer, so the policy must not be "same-origin".
    response = APIClient().get("/plan")
    assert response["Referrer-Policy"] == "strict-origin-when-cross-origin"
