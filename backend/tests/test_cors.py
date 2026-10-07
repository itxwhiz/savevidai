import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.main import create_app

ORIGIN = "https://savevidai.example"


def client(monkeypatch, origins=ORIGIN):
    monkeypatch.setenv("CORS_ORIGINS", origins)
    return TestClient(create_app())


def test_public_api_preflight(monkeypatch):
    response = client(monkeypatch).options("/api/resolve", headers={
        "Origin": ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in response.headers


@respx.mock
def test_media_stream_and_errors_have_cors(monkeypatch):
    c = client(monkeypatch)
    respx.get("https://video.twimg.com/v.mp4").mock(
        return_value=httpx.Response(200, content=b"video", headers={"content-length": "5"}))
    response = c.get("/api/proxy", params={"url": "https://video.twimg.com/v.mp4"},
                     headers={"Origin": ORIGIN})
    assert response.content == b"video"
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "Content-Disposition" in response.headers["access-control-expose-headers"]
    response = c.get("/api/proxy", params={"url": "http://127.0.0.1/"},
                     headers={"Origin": ORIGIN})
    assert response.status_code == 403
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_maintenance_response_and_preflight_have_cors(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_MODE", "1")
    c = client(monkeypatch)
    response = c.options("/api/resolve", headers={
        "Origin": ORIGIN, "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 200
    response = c.post("/api/resolve", json={"url": "x"}, headers={"Origin": ORIGIN})
    assert response.status_code == 503
    assert response.json()["error"] == "maintenance"
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_cors_disabled_by_default(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    response = TestClient(create_app()).get("/api/health", headers={"Origin": ORIGIN})
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("origin", ["https://evil.example", "https://savevidai.example.evil"])
def test_unlisted_origin_rejected(monkeypatch, origin):
    response = client(monkeypatch).options("/api/resolve", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("value", ["*", "https://*.vercel.app", "null", "http://site.example",
                                  "https://user:pass@site.example", "https://site.example/path",
                                  "https://site.example?token=x", "https://site.example#x",
                                  "https://faß.example", "https://%65xample.com"])
def test_bad_configuration_fails_clearly(monkeypatch, value):
    monkeypatch.setenv("CORS_ORIGINS", value)
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        create_app()


def test_multiple_exact_origins_and_local_development(monkeypatch):
    c = client(monkeypatch, f"{ORIGIN}/, http://localhost:5173")
    response = c.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


@pytest.mark.parametrize(("configured", "origin"), [
    ("https://SAVEVIDAI.example:443/", ORIGIN),
    ("http://localhost:80", "http://localhost"),
    ("http://[::1]:8000", "http://[::1]:8000"),
    ("https://[0:0:0:0:0:0:0:1]:443", "https://[::1]"),
])
def test_browser_origin_normalization(monkeypatch, configured, origin):
    response = client(monkeypatch, configured).get("/api/health", headers={"Origin": origin})
    assert response.headers["access-control-allow-origin"] == origin
