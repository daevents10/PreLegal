"""Tests for the /api/auth routes."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from prelegal_backend.auth import COOKIE_NAME, JWT_ALGORITHM, hash_password, verify_password

EMAIL = "alice@example.com"
PASSWORD = "s3cret-password"


def signup(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def test_password_hashing_roundtrip() -> None:
    hashed = hash_password(PASSWORD)
    assert hashed != PASSWORD and hashed.startswith("$2")
    assert verify_password(PASSWORD, hashed)
    assert not verify_password("wrong-password", hashed)


def test_signup_creates_user_and_signs_in(client: TestClient) -> None:
    response = signup(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == EMAIL and isinstance(body["id"], int) and body["created_at"]
    assert "password" not in str(body)

    set_cookie = response.headers["set-cookie"]
    assert COOKIE_NAME in set_cookie and "HttpOnly" in set_cookie and "samesite=lax" in set_cookie.lower()
    assert client.get("/api/auth/me").json() == body


def test_signup_duplicate_email_conflicts(client: TestClient) -> None:
    assert signup(client).status_code == 201
    response = signup(client, email=EMAIL.upper())
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": EMAIL, "password": "short"},
        {"email": EMAIL, "password": "é" * 37},  # 74 bytes: over bcrypt's 72-byte limit
        {"email": EMAIL},
        {},
    ],
)
def test_signup_rejects_invalid_input(client: TestClient, payload: dict) -> None:
    assert client.post("/api/auth/signup", json=payload).status_code == 422


def test_signin_with_valid_credentials(client: TestClient) -> None:
    signup(client)
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401

    response = client.post("/api/auth/signin", json={"email": EMAIL.upper(), "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["email"] == EMAIL
    assert client.get("/api/auth/me").json()["email"] == EMAIL


@pytest.mark.parametrize(
    "email,password",
    [(EMAIL, "wrong-password"), ("nobody@example.com", PASSWORD)],
)
def test_signin_rejects_bad_credentials(client: TestClient, email: str, password: str) -> None:
    signup(client)
    client.cookies.clear()
    response = client.post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
    assert COOKIE_NAME not in response.cookies


def test_signout_clears_session(client: TestClient) -> None:
    signup(client)
    response = client.post("/api/auth/signout")
    assert response.status_code == 204
    assert COOKIE_NAME in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def _token(client: TestClient, *, secret: str | None = None, **overrides) -> str:
    now = datetime.now(UTC)
    payload = {"sub": "1", "iat": now, "exp": now + timedelta(hours=1), **overrides}
    return jwt.encode(payload, secret or client.app.state.secret_key, algorithm=JWT_ALGORITHM)


@pytest.mark.parametrize(
    "make_token",
    [
        lambda c: "garbage",
        lambda c: _token(c, secret="some-other-secret-key-of-enough-length"),
        lambda c: _token(c, exp=datetime.now(UTC) - timedelta(seconds=1)),
        lambda c: _token(c, sub="not-a-number"),
        lambda c: _token(c, sub="999"),  # user does not exist (e.g. DB was reset)
    ],
    ids=["garbage", "wrong-secret", "expired", "bad-subject", "unknown-user"],
)
def test_me_rejects_invalid_sessions(client: TestClient, make_token) -> None:
    signup(client)
    client.cookies.set(COOKIE_NAME, make_token(client))
    assert client.get("/api/auth/me").status_code == 401


def test_valid_forged_token_for_existing_user_is_accepted(client: TestClient) -> None:
    """Sanity check for the test helper: a correctly signed token authenticates."""
    user_id = signup(client).json()["id"]
    client.cookies.clear()
    client.cookies.set(COOKIE_NAME, _token(client, sub=str(user_id)))
    assert client.get("/api/auth/me").json()["email"] == EMAIL


def test_secret_key_from_environment(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from prelegal_backend.main import create_app

    monkeypatch.setenv("PRELEGAL_SECRET_KEY", "configured-secret-key-for-tests-0123456789")
    assert create_app(static_dir=tmp_path).state.secret_key == "configured-secret-key-for-tests-0123456789"
