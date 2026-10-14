"""API tests for StockPilot backend (18 tests)."""
from fastapi.testclient import TestClient


# ── infrastructure endpoints ──────────────────────────────────────────


def test_health(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready(client: TestClient):
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


def test_metrics_contains_expected_counters(client: TestClient):
    r = client.get("/metrics")
    assert r.status_code == 200
    body = r.text
    assert "http_requests_total" in body
    assert "units_issued_total" in body


# ── create ────────────────────────────────────────────────────────────


def test_create_returns_201_with_status(client: TestClient, item_payload: dict):
    r = client.post("/api/items", json=item_payload)
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "IN_STOCK"
    assert "created_at" in data
    assert data["id"] is not None


# ── status boundaries ────────────────────────────────────────────────


def test_status_out_of_stock(client: TestClient, item_payload: dict):
    item_payload["quantity"] = 0
    r = client.post("/api/items", json=item_payload)
    assert r.json()["status"] == "OUT_OF_STOCK"


def test_status_low_at_reorder_level(client: TestClient, item_payload: dict):
    item_payload["quantity"] = item_payload["reorder_level"]  # 5 == 5
    r = client.post("/api/items", json=item_payload)
    assert r.json()["status"] == "LOW"


def test_status_in_stock_above_reorder(client: TestClient, item_payload: dict):
    item_payload["quantity"] = item_payload["reorder_level"] + 1
    r = client.post("/api/items", json=item_payload)
    assert r.json()["status"] == "IN_STOCK"


# ── get / list ────────────────────────────────────────────────────────


def test_get_by_id(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    r = client.get(f"/api/items/{created['id']}")
    assert r.status_code == 200
    assert r.json()["sku"] == item_payload["sku"]


def test_get_unknown_id_404(client: TestClient):
    r = client.get("/api/items/9999")
    assert r.status_code == 404


def test_list_and_status_filter(client: TestClient, item_payload: dict):
    # Create one IN_STOCK (qty 10, reorder 5) and one OUT_OF_STOCK (qty 0)
    client.post("/api/items", json=item_payload)
    oos = item_payload.copy()
    oos["sku"] = "OOS-001"
    oos["quantity"] = 0
    client.post("/api/items", json=oos)

    all_items = client.get("/api/items").json()
    assert len(all_items) == 2

    filtered = client.get("/api/items?status=OUT_OF_STOCK").json()
    assert len(filtered) == 1
    assert filtered[0]["sku"] == "OOS-001"


# ── stats ─────────────────────────────────────────────────────────────


def test_stats_counts(client: TestClient, item_payload: dict):
    # IN_STOCK: qty 10, reorder 5
    client.post("/api/items", json=item_payload)
    # LOW: qty == reorder_level
    low = item_payload.copy()
    low["sku"] = "LOW-001"
    low["quantity"] = 5
    client.post("/api/items", json=low)
    # OUT_OF_STOCK: qty 0
    oos = item_payload.copy()
    oos["sku"] = "OOS-001"
    oos["quantity"] = 0
    client.post("/api/items", json=oos)

    r = client.get("/api/items/stats")
    assert r.status_code == 200
    data = r.json()
    assert data == {"total": 3, "in_stock": 1, "low": 1, "out_of_stock": 1}


# ── validation ────────────────────────────────────────────────────────


def test_negative_quantity_422(client: TestClient, item_payload: dict):
    item_payload["quantity"] = -1
    r = client.post("/api/items", json=item_payload)
    assert r.status_code == 422


def test_empty_name_422(client: TestClient, item_payload: dict):
    item_payload["name"] = "   "
    r = client.post("/api/items", json=item_payload)
    assert r.status_code == 422


def test_empty_sku_422(client: TestClient, item_payload: dict):
    item_payload["sku"] = ""
    r = client.post("/api/items", json=item_payload)
    assert r.status_code == 422


# ── duplicate sku ─────────────────────────────────────────────────────


def test_duplicate_sku_create_409(client: TestClient, item_payload: dict):
    client.post("/api/items", json=item_payload)
    r = client.post("/api/items", json=item_payload)
    assert r.status_code == 409


def test_duplicate_sku_put_409(client: TestClient, item_payload: dict):
    client.post("/api/items", json=item_payload)
    second = item_payload.copy()
    second["sku"] = "OTHER-001"
    created = client.post("/api/items", json=second).json()

    # Try to change second item's SKU to the first item's SKU
    second["sku"] = item_payload["sku"]
    r = client.put(f"/api/items/{created['id']}", json=second)
    assert r.status_code == 409


# ── update (PUT) ──────────────────────────────────────────────────────


def test_update_recalculates_status(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    assert created["status"] == "IN_STOCK"

    item_payload["quantity"] = 0
    r = client.put(f"/api/items/{created['id']}", json=item_payload)
    assert r.status_code == 200
    assert r.json()["status"] == "OUT_OF_STOCK"


# ── delete ────────────────────────────────────────────────────────────


def test_delete_then_get_404(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    r = client.delete(f"/api/items/{created['id']}")
    assert r.status_code == 204

    r = client.get(f"/api/items/{created['id']}")
    assert r.status_code == 404


# ── issue ─────────────────────────────────────────────────────────────


def test_issue_success(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    r = client.post(f"/api/items/{created['id']}/issue", json={"quantity": 3})
    assert r.status_code == 200
    data = r.json()
    assert data["quantity"] == 7
    assert "created_at" in data
    assert data["status"] == "IN_STOCK"


def test_issue_more_than_available_409(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    r = client.post(f"/api/items/{created['id']}/issue", json={"quantity": 999})
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert item_payload["sku"] in detail
    assert str(item_payload["quantity"]) in detail
    assert "999" in detail

    # Stock must be unchanged
    after = client.get(f"/api/items/{created['id']}").json()
    assert after["quantity"] == item_payload["quantity"]


def test_issue_unknown_id_404(client: TestClient):
    r = client.post("/api/items/9999/issue", json={"quantity": 1})
    assert r.status_code == 404


def test_issue_zero_or_negative_422(client: TestClient, item_payload: dict):
    created = client.post("/api/items", json=item_payload).json()
    r = client.post(f"/api/items/{created['id']}/issue", json={"quantity": 0})
    assert r.status_code == 422

    r = client.post(f"/api/items/{created['id']}/issue", json={"quantity": -5})
    assert r.status_code == 422
