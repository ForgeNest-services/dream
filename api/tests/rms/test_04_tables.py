"""Ordered test #4: tables (physical seating within a zone) -- create,
label uniqueness, status, reservations, merge/unmerge. Depends on
test_03_zones.py's "Main Floor" zone existing. Real HTTP against the live
srota-api container, both business types side by side."""
import pytest

from conftest import auth_headers


def _main_floor_zone_id(api_client, business, tokens) -> str:
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    return next(z for z in resp.json()["data"] if z["name"] == "Main Floor")["id"]


def _existing_table_count(api_client, business, tokens) -> int:
    """Not necessarily 0 -- test_08_orders.py's tables become permanently
    undeletable once referenced by a paid/cancelled order (immutability
    trigger, by design), so a second+ full-suite run can see real leftover
    tables here. Baseline against whatever's already there instead of
    assuming a hard empty state."""
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["waiter"]),
    )
    return len(resp.json()["data"])


def test_list_tables_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text


def test_waiter_cannot_create_table(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["waiter"]),
        json={"zone_id": zone_id, "label": "T1"},
    )
    assert resp.status_code == 403


def test_manager_can_create_table(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["manager"]),
        json={"zone_id": zone_id, "label": "T1"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["label"] == "T1"
    assert data["zone_id"] == zone_id
    assert data["status"] == "empty"
    assert data["merge_id"] is None


def test_empty_label_rejected(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": "   "},
    )
    assert resp.status_code == 422


def test_duplicate_label_in_same_zone_rejected(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": "T1"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "LABEL_TAKEN"


def test_owner_creates_second_table(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": "T2"},
    )
    assert resp.status_code == 201, resp.text


def test_list_tables_shows_both(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["chef"]),
    )
    assert resp.status_code == 200, resp.text
    labels = {t["label"] for t in resp.json()["data"]}
    assert {"T1", "T2"} <= labels  # subset -- other (permanent) tables may coexist


def test_filter_tables_by_zone(api_client, business, tokens):
    zone_id = _main_floor_zone_id(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        params={"zone_id": zone_id},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    labels = {t["label"] for t in resp.json()["data"]}
    assert {"T1", "T2"} <= labels


def test_manager_can_rename_table(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
    )
    t2 = next(t for t in resp.json()["data"] if t["label"] == "T2")

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/tables/{t2['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"label": "T2-Renamed"},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["label"] == "T2-Renamed"


def test_invalid_status_rejected(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
    )
    t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/tables/{t1['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"status": "on-fire"},
    )
    assert resp2.status_code == 422
    assert resp2.json()["error"]["code"] == "INVALID_STATUS"


class TestReservations:
    def test_any_staff_can_reserve_a_table(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/{t1['id']}/reserve",
            headers=auth_headers(tokens["waiter"]),
            json={
                "guest_name": "Test Guest",
                "phone": "9800000000",
                "date": "2026-12-25",
                "time": "19:00",
                "party_size": 4,
            },
        )
        assert resp2.status_code == 200, resp2.text
        data = resp2.json()["data"]
        assert data["status"] == "reserved"
        assert data["reservation_guest_name"] == "Test Guest"

    def test_empty_guest_name_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t2 = next(t for t in resp.json()["data"] if t["label"] == "T2-Renamed")

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/{t2['id']}/reserve",
            headers=auth_headers(tokens["owner"]),
            json={"guest_name": "  ", "date": "2026-12-25", "time": "19:00", "party_size": 2},
        )
        assert resp2.status_code == 422

    def test_clear_reservation(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")
        assert t1["status"] == "reserved"

        resp2 = api_client.delete(
            f"/restro/branches/{business['branch_id']}/tables/{t1['id']}/reservation",
            headers=auth_headers(tokens["waiter"]),
        )
        assert resp2.status_code == 200, resp2.text
        assert resp2.json()["data"]["status"] == "empty"
        assert resp2.json()["data"]["reservation_guest_name"] is None

    def test_clearing_reservation_when_none_exists_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")

        resp2 = api_client.delete(
            f"/restro/branches/{business['branch_id']}/tables/{t1['id']}/reservation",
            headers=auth_headers(tokens["owner"]),
        )
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "NO_RESERVATION"


class TestMergeUnmerge:
    def test_merge_needs_at_least_two_tables(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/merge",
            headers=auth_headers(tokens["owner"]),
            json={"table_ids": [t1["id"]]},
        )
        assert resp2.status_code == 422

    def test_merge_two_tables(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        tables = resp.json()["data"]
        t1 = next(t for t in tables if t["label"] == "T1")
        t2 = next(t for t in tables if t["label"] == "T2-Renamed")

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/merge",
            headers=auth_headers(tokens["manager"]),
            json={"table_ids": [t1["id"], t2["id"]]},
        )
        assert resp2.status_code == 200, resp2.text
        merged = resp2.json()["data"]
        assert len(merged) == 2
        merge_ids = {t["merge_id"] for t in merged}
        assert len(merge_ids) == 1
        assert None not in merge_ids

    def test_merging_an_already_merged_table_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        tables = resp.json()["data"]
        t1 = next(t for t in tables if t["label"] == "T1")

        # A third table to attempt merging with the already-merged T1.
        zone_id = _main_floor_zone_id(api_client, business, tokens)
        create_resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
            json={"zone_id": zone_id, "label": "T3"},
        )
        t3 = create_resp.json()["data"]

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/merge",
            headers=auth_headers(tokens["owner"]),
            json={"table_ids": [t1["id"], t3["id"]]},
        )
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "TABLE_ALREADY_MERGED"

    def test_unmerge(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")
        assert t1["merge_id"] is not None

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/{t1['id']}/unmerge",
            headers=auth_headers(tokens["manager"]),
        )
        assert resp2.status_code == 200, resp2.text

        resp3 = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1_after = next(t for t in resp3.json()["data"] if t["label"] == "T1")
        assert t1_after["merge_id"] is None

    def test_unmerging_a_table_not_in_a_merge_group_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
        )
        t1 = next(t for t in resp.json()["data"] if t["label"] == "T1")

        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables/{t1['id']}/unmerge",
            headers=auth_headers(tokens["owner"]),
        )
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "NOT_MERGED"


def test_waiter_cannot_delete_table(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
    )
    t3 = next(t for t in resp.json()["data"] if t["label"] == "T3")

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/tables/{t3['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp2.status_code == 403


def test_owner_can_delete_empty_table(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
    )
    t3 = next(t for t in resp.json()["data"] if t["label"] == "T3")

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/tables/{t3['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp2.status_code == 200, resp2.text
