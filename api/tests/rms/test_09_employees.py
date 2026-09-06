"""Ordered test #9: employees (staff directory -- distinct from RestroCredential
logins; an "employee" here is an HR-style record: designation/phone/salary/
shift, no login of its own). Depends on test_01-08 passing first. Starts
genuinely empty like customers (no auto-seed). Real HTTP against the live
srota-api container, both business types."""
from conftest import auth_headers


def test_list_employees_starts_empty(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == []


def test_waiter_cannot_create_employee(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
        json={"name": "Hari Bahadur", "designation": "Waiter", "phone": "9811111111"},
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_create_employee(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["manager"]),
        json={
            "name": "Hari Bahadur",
            "designation": "Waiter",
            "phone": "9811111111",
            "salary": "15000",
            "shift": "morning",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Hari Bahadur"
    assert data["designation"] == "Waiter"
    assert data["phone"] == "9811111111"
    assert float(data["salary"]) == 15000.0
    assert data["shift"] == "morning"
    assert data["is_active"] is True


def test_create_employee_defaults(api_client, business, tokens):
    """designation/phone/salary/shift all have defaults -- only name is
    required."""
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Sita Gurung"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["designation"] == "Waiter"
    assert data["phone"] == ""
    assert float(data["salary"]) == 0.0
    assert data["shift"] is None


def test_empty_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["owner"]),
        json={"name": "   "},
    )
    assert resp.status_code == 422, resp.text


def test_negative_salary_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Negative Salary Guy", "salary": "-100"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_SALARY"


def test_duplicate_phone_allowed(api_client, business, tokens):
    """Unlike customers, employees have no phone-uniqueness constraint --
    two staff members can share a household landline, for instance."""
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Same Phone Guy", "phone": "9811111111"},
    )
    assert resp.status_code == 201, resp.text


def test_list_employees_shows_created(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    names = {e["name"] for e in resp.json()["data"]}
    assert {"Hari Bahadur", "Sita Gurung", "Same Phone Guy"} <= names


def test_waiter_cannot_update_employee(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee_id = list_resp.json()["data"][0]["id"]
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/{employee_id}",
        headers=auth_headers(tokens["waiter"]),
        json={"salary": "20000"},
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_update_employee(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Hari Bahadur")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"salary": "18000", "designation": "Senior Waiter"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert float(data["salary"]) == 18000.0
    assert data["designation"] == "Senior Waiter"
    # untouched fields survive the partial update
    assert data["phone"] == "9811111111"


def test_update_negative_salary_rejected(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Hari Bahadur")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"salary": "-1"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_SALARY"


def test_clear_shift(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Hari Bahadur")
    assert employee["shift"] == "morning"
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"clear_shift": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["shift"] is None


def test_deactivate_employee(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Sita Gurung")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["is_active"] is False


def test_updating_nonexistent_employee_returns_404(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/employees/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={"salary": "1000"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_waiter_cannot_delete_employee(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Same Phone Guy")
    resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_delete_employee(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    employee = next(e for e in list_resp.json()["data"] if e["name"] == "Same Phone Guy")
    resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/employees/{employee['id']}",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 200, resp.text

    list_resp2 = api_client.get(
        f"/restro/branches/{business['branch_id']}/employees",
        headers=auth_headers(tokens["waiter"]),
    )
    names = {e["name"] for e in list_resp2.json()["data"]}
    assert "Same Phone Guy" not in names
