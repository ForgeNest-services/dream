"""Ordered test #3: zones (floor sections tables live in). Depends on
test_01/test_02 passing first. Creates one real zone per business that
test_04_tables.py builds real tables into -- not deleted at the end of this
file, since later tests depend on it existing."""
import pytest

from conftest import auth_headers


def test_list_zones_auto_provisions_main_floor(api_client, business, tokens):
    """ZoneService.list_for_branch auto-creates a 'Main Floor' zone on the
    first call if none exist yet (zone_service.py's DEFAULT_ZONE_NAME) --
    real, intentional app behavior, not test setup. This is what
    test_04_tables.py's real tables get built into."""
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    names = [z["name"] for z in resp.json()["data"]]
    assert names == ["Main Floor"]


def test_waiter_cannot_create_zone(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["waiter"]),
        json={"name": "Should Fail"},
    )
    assert resp.status_code == 403


def test_manager_can_create_zone(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Second Floor", "display_order": 1},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Second Floor"
    assert data["display_order"] == 1
    assert data["is_active"] is True
    assert data["branch_id"] == business["branch_id"]


def test_zone_name_must_be_unique_per_branch(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Main Floor"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_empty_zone_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
        json={"name": "   "},
    )
    assert resp.status_code == 422


def test_owner_can_create_second_zone(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Outdoor Seating", "display_order": 2},
    )
    assert resp.status_code == 201, resp.text


def test_list_zones_now_shows_all_three(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["chef"]),
    )
    assert resp.status_code == 200, resp.text
    names = {z["name"] for z in resp.json()["data"]}
    assert names == {"Main Floor", "Second Floor", "Outdoor Seating"}


def test_manager_can_rename_zone(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    outdoor = next(z for z in list_resp.json()["data"] if z["name"] == "Outdoor Seating")

    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/zones/{outdoor['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Rooftop"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["name"] == "Rooftop"


def test_waiter_cannot_delete_zone(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    rooftop = next(z for z in list_resp.json()["data"] if z["name"] == "Rooftop")

    resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/zones/{rooftop['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 403


def test_owner_can_delete_empty_zone(api_client, business, tokens):
    """Rooftop has no tables yet -- deletable. Main Floor is left standing
    on purpose: test_04_tables.py builds real tables into it."""
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    rooftop = next(z for z in list_resp.json()["data"] if z["name"] == "Rooftop")

    resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/zones/{rooftop['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text

    list_resp2 = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    names = {z["name"] for z in list_resp2.json()["data"]}
    assert names == {"Main Floor", "Second Floor"}
