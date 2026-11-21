"""User sign up / sign in. Sessions are JWTs carried in an HttpOnly cookie."""

import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from prelegal_backend.db import connection

COOKIE_NAME = "prelegal_session"
SESSION_TTL = timedelta(days=7)
JWT_ALGORITHM = "HS256"
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt's input limit

# Compared against when the email is unknown, so sign-in takes the same time either way.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError(f"password must be at most {MAX_PASSWORD_BYTES} bytes")
        return value


class User(BaseModel):
    id: int
    email: str
    created_at: str


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    yield from connection(request.app.state.db_path)


Db = Annotated[sqlite3.Connection, Depends(get_db)]

_USER_COLUMNS = "id, email, created_at"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_session_token(user_id: int, secret: str) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + SESSION_TTL}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def _set_session_cookie(response: Response, request: Request, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(user_id, request.app.state.secret_key),
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )


def current_user(
    request: Request,
    db: Db,
    session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> User:
    """Dependency: the signed-in user, or 401."""
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    if not session:
        raise unauthorized
    try:
        payload = jwt.decode(session, request.app.state.secret_key, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized from None
    row = db.execute(f"SELECT {_USER_COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise unauthorized
    return User(**row)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(credentials: Credentials, request: Request, response: Response, db: Db) -> User:
    try:
        row = db.execute(
            f"INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING {_USER_COLUMNS}",
            (credentials.email, hash_password(credentials.password)),
        ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists") from None
    user = User(**row)
    _set_session_cookie(response, request, user.id)
    return user


@router.post("/signin")
def signin(credentials: Credentials, request: Request, response: Response, db: Db) -> User:
    row = db.execute(
        f"SELECT {_USER_COLUMNS}, password_hash FROM users WHERE email = ?", (credentials.email,)
    ).fetchone()
    if not verify_password(credentials.password, row["password_hash"] if row else _DUMMY_HASH) or row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    user = User(id=row["id"], email=row["email"], created_at=row["created_at"])
    _set_session_cookie(response, request, user.id)
    return user


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, httponly=True, samesite="lax")


@router.get("/me")
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user
