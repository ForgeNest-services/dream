"""Shared fixtures for the RMS black-box HTTP test suite. Runs on the HOST
(not inside a container) against the real, live srota-api container over
HTTP -- genuine end-to-end testing, not mocked, not in-process.

Requires api/tests/rms/dummy_tenants.json to already exist (see
seed_dummy_tenants.py's own docstring for how to (re)generate it).
"""
import json
import os
import pytest
import httpx

BASE_URL = os.environ.get("RMS_TEST_BASE_URL", "http://localhost:8006")

_DUMMY_TENANTS_PATH = os.path.join(os.path.dirname(__file__), "dummy_tenants.json")


@pytest.fixture(scope="session")
def dummy_tenants() -> dict:
    if not os.path.exists(_DUMMY_TENANTS_PATH):
        pytest.fail(
            f"{_DUMMY_TENANTS_PATH} not found -- run seed_dummy_tenants.py "
            "inside the api container first (see its own docstring)."
        )
    with open(_DUMMY_TENANTS_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="session", params=["pan", "vat"])
def business(request, dummy_tenants) -> dict:
    """Parametrized over both business types -- any test using this fixture
    runs once per business type automatically, side by side."""
    return dummy_tenants[request.param]


@pytest.fixture(scope="session")
def api_client():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client


def login(api_client: httpx.Client, username: str, password: str) -> str:
    """Real login call, returns the JWT. Raises if login fails -- tests that
    need a working token shouldn't silently proceed on a broken one."""
    resp = api_client.post("/restro/auth/login", json={"username": username, "password": password})
    resp.raise_for_status()
    return resp.json()["data"]["token"]


@pytest.fixture(scope="session")
def tokens(api_client, business) -> dict:
    """One real JWT per role for the current business, fetched once per
    session/business (login is already covered exhaustively by
    test_01_login.py -- later test files just need a working token)."""
    return {
        role: login(api_client, creds["username"], creds["password"])
        for role, creds in business["credentials"].items()
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _owner_token_for(api_client, dummy_tenants, key: str) -> str:
    creds = dummy_tenants[key]["credentials"]["owner"]
    return login(api_client, creds["username"], creds["password"])


@pytest.fixture(scope="session")
def owner_token_pan(api_client, dummy_tenants) -> str:
    """A real owner JWT for specifically the PAN-only tenant -- for tests
    that assert on one business type's behavior, not both in parallel (the
    business/tokens fixtures cover the parallel case)."""
    return _owner_token_for(api_client, dummy_tenants, "pan")


@pytest.fixture(scope="session")
def owner_token_vat(api_client, dummy_tenants) -> str:
    """A real owner JWT for specifically the VAT-registered tenant."""
    return _owner_token_for(api_client, dummy_tenants, "vat")
