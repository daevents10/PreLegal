"""Tests for the FastAPI app: health endpoint and static frontend serving."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.main import DEFAULT_STATIC_DIR, create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    (tmp_path / "index.html").write_text("<html><body>Mutual NDA Creator</body></html>")
    (tmp_path / "404.html").write_text("not found")
    (tmp_path / "_next").mkdir()
    (tmp_path / "_next" / "app.js").write_text("console.log('hi')")
    return tmp_path


def test_health_without_frontend_warns(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    missing = tmp_path / "missing"
    with caplog.at_level("WARNING"):
        client = TestClient(create_app(missing))
    assert "Frontend build not found" in caplog.text
    assert str(missing) in caplog.text
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 404


def test_no_warning_when_frontend_present(static_dir: Path, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level("WARNING"):
        create_app(static_dir)
    assert "Frontend build not found" not in caplog.text


def test_serves_frontend_index_and_assets(static_dir: Path) -> None:
    client = TestClient(create_app(static_dir))
    index = client.get("/")
    assert index.status_code == 200
    assert "Mutual NDA Creator" in index.text
    asset = client.get("/_next/app.js")
    assert asset.status_code == 200
    assert "javascript" in asset.headers["content-type"]


def test_api_routes_take_precedence_over_static(static_dir: Path) -> None:
    client = TestClient(create_app(static_dir))
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_path_is_404(static_dir: Path) -> None:
    assert TestClient(create_app(static_dir)).get("/nope").status_code == 404


def test_static_dir_from_environment(static_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(static_dir))
    assert "Mutual NDA Creator" in TestClient(create_app()).get("/").text


@pytest.mark.skipif(
    not (DEFAULT_STATIC_DIR / "index.html").is_file(),
    reason="frontend not built (run `npm run build` in frontend/)",
)
def test_integration_serves_built_nda_creator() -> None:
    """Integration: the real Next.js export is served with the NDA creator and Standard Terms."""
    client = TestClient(create_app())
    page = client.get("/")
    assert page.status_code == 200
    assert "Mutual NDA Creator" in page.text
    assert "Standard Terms" in page.text
    assert "Governing Law and Jurisdiction" in page.text
    assert client.get("/api/health").json() == {"status": "ok"}
