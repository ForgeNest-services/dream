import json
import os
import pytest
import httpx

BASE_URL = os.environ.get("IMS_TEST_BASE_URL", "http://localhost:8006")
_DUMMY_TENANTS_PATH = os.path.join(os.path.dirname(__file__), "dummy_tenants.json")


@pytest.fixture(scope="session")
def dummy_tenants() -> dict:
    if not os.path.exists(_DUMMY_TENANTS_PATH):
        pytest.fail(
            f"{_DUMMY_TENANTS_PATH} not found -- run "
            "`docker exec srota-api python /app/tests/ims/seed_dummy_tenants.py` first."
        )
    with open(_DUMMY_TENANTS_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="session", params=["pan", "vat"])
def business(request, dummy_tenants) -> dict:
    return dummy_tenants[request.param]


@pytest.fixture(scope="session")
def api_client():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client


def login(api_client, username, password) -> str:
    resp = api_client.post("/ims/auth/login", json={"username": username, "password": password})
    resp.raise_for_status()
    return resp.json()["data"]["token"]


@pytest.fixture(scope="session")
def tokens(api_client, business) -> dict:
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
    return _owner_token_for(api_client, dummy_tenants, "pan")


@pytest.fixture(scope="session")
def owner_token_vat(api_client, dummy_tenants) -> str:
    return _owner_token_for(api_client, dummy_tenants, "vat")
