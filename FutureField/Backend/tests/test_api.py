"""API contract + full journey on mock data."""
from fastapi.testclient import TestClient

from app.main import app


def test_full_journey():
    with TestClient(app) as client:  # runs lifespan -> seeds demo fields
        assert client.get("/health").json()["status"] == "ok"
        fields = client.get("/fields").json()
        assert {f["id"] for f in fields} >= {"demo-1", "demo-2"}
        fid = "demo-1"

        env = client.get(f"/fields/{fid}/environment").json()
        assert env["source"] == "mock" and 0 <= env["quality_score"] <= 1

        assert "water_score" in client.get(f"/fields/{fid}/intelligence").json()

        suit = client.post(f"/fields/{fid}/suitability", json={"priorities": {"water": 0.9}}).json()
        assert len(suit["results"]) >= 5  # crops.json may grow

        rots = client.post(f"/fields/{fid}/rotations", json={}).json()["rotations"]
        assert rots

        sim = client.post(f"/fields/{fid}/simulate", json={"params": {"rainfall_pct": -20}}).json()
        assert sim["crop_deltas"] and sim["limitation"]

        plan = client.post(f"/fields/{fid}/plan", json={"rotation": rots[0]}).json()
        assert len(plan["calendar"]) == 3

        # Verify GET /plans/{plan_id} works
        fetched_plan = client.get(f"/plans/{plan['id']}").json()
        assert fetched_plan["id"] == plan["id"]

        out = client.post(f"/plans/{plan['id']}/outcome",
                          json={"actual_crops": plan["rotation"]["crop_ids"]}).json()
        assert out["comparison"]["crop_match_per_slot"] == [True, True, True]

        # Verify GET /plans/{plan_id}/outcome works
        fetched_out = client.get(f"/plans/{plan['id']}/outcome").json()
        assert fetched_out["plan_id"] == plan["id"]


def test_errors():
    with TestClient(app) as client:
        assert client.get("/fields/nope").status_code == 404
        bad = {"name": "x", "boundary": {"type": "Point", "coordinates": [0, 0]}}
        assert client.post("/fields", json=bad).status_code == 422

        # 404 for unknown plan
        assert client.get("/plans/doesnotexist").status_code == 404


def test_update_field_invalidates_environment():
    with TestClient(app) as client:
        fid = "demo-1"
        env1 = client.get(f"/fields/{fid}/environment").json()
        field = client.get(f"/fields/{fid}").json()
        ring = field["boundary"]["coordinates"][0]
        shifted = [[lon + 0.01, lat] for lon, lat in ring]
        field["boundary"]["coordinates"] = [shifted]
        body = {k: field[k] for k in ("name", "boundary", "irrigation_type", "water_source", "soil", "crop_history")}
        # Test both PATCH and PUT verbs
        assert client.patch(f"/fields/{fid}", json=body).status_code == 200
        assert client.put(f"/fields/{fid}", json=body).status_code == 200
        env2 = client.get(f"/fields/{fid}/environment").json()
        assert env2["fetched_at"] != env1["fetched_at"]


def test_delete_field():
    """Create a field, verify it exists, delete it, verify 404."""
    with TestClient(app) as client:
        import math
        boundary = {
            "type": "Polygon",
            "coordinates": [[[88.0, 22.0], [88.1, 22.0], [88.1, 22.1], [88.0, 22.1], [88.0, 22.0]]]
        }
        new_field = client.post("/fields", json={
            "name": "Temp Field",
            "boundary": boundary,
        }).json()
        fid = new_field["id"]
        assert client.get(f"/fields/{fid}").status_code == 200
        assert client.delete(f"/fields/{fid}").status_code == 204
        assert client.get(f"/fields/{fid}").status_code == 404

