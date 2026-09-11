import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

print("=" * 80)
print("  ORCA PFZ DYNAMIC GEOFENCING & MAP STATE VERIFICATION")
print("=" * 80)

# Step 1: Query PFZ from backend
payload = {
    "query": "Show me nearby fishing zones",
    "latitude": 19.72,
    "longitude": 72.70,
    "date": "2026-09-12",
    "boat_width_m": 5.0,
    "language": "en"
}

print(f"\n[1] Querying ORCA backend at {BASE_URL}/api/orca/assess ...")
res = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=45)
if res.status_code != 200:
    print(f"[FAIL] Backend returned HTTP {res.status_code}: {res.text}")
    sys.exit(1)

data = res.json()
cands = data.get("pfz", {}).get("top_candidates") or data.get("top_pfz") or []
print(f"[OK] Received {len(cands)} PFZ candidate(s).")

if len(cands) < 3:
    print(f"[FAIL] Expected at least 3 candidates, got {len(cands)}")
    sys.exit(1)

for c in cands:
    print(f"\n  Candidate #{c.get('rank')} (ID: {c.get('id')}):")
    print(f"    Coords: {c.get('coordinates')}")
    geom = c.get("geometry") or {}
    coords = geom.get("coordinates", [])
    first_pt = coords[0][0] if (coords and isinstance(coords[0], list) and coords[0]) else None
    print(f"    Geom Type: {geom.get('type')}, Lines: {len(coords)}, First Point: {first_pt}")
    assert geom.get("type") in ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]
    assert len(coords) > 0, f"Candidate #{c.get('rank')} missing geometry coordinates!"

# Step 2: Simulate OrcaMapComponent dynamic geofence resolution
print("\n[2] Simulating OrcaMapComponent activePFZGeometry resolution:")

def resolve_map_geofence(cands_list, selected_id):
    active_cand = next((c for c in cands_list if c.get("id") == selected_id), cands_list[0])
    active_geom = active_cand.get("geometry")
    return active_cand, active_geom

# TEST 1: Initial state (PFZ #1 selected)
cand1, geom1 = resolve_map_geofence(cands, cands[0]["id"])
print(f"\n  TEST 1 - Select PFZ #1:")
print(f"    Active ID  : {cand1['id']}")
print(f"    First Coord: {geom1['coordinates'][0][0]}")
assert cand1["id"] == cands[0]["id"]
assert geom1 == cands[0]["geometry"]
print("    [PASS] TEST 1: Active geofence is PFZ #1's geometry.")

# TEST 2: Select PFZ #2
cand2, geom2 = resolve_map_geofence(cands, cands[1]["id"])
print(f"\n  TEST 2 - Select PFZ #2:")
print(f"    Active ID  : {cand2['id']}")
print(f"    First Coord: {geom2['coordinates'][0][0]}")
assert cand2["id"] == cands[1]["id"]
assert geom2 == cands[1]["geometry"]
assert geom2 != geom1, "PFZ #2 geofence must NOT equal PFZ #1 geofence!"
print("    [PASS] TEST 2: Active geofence dynamically updated to PFZ #2's geometry.")

# TEST 3: Select PFZ #3
cand3, geom3 = resolve_map_geofence(cands, cands[2]["id"])
print(f"\n  TEST 3 - Select PFZ #3:")
print(f"    Active ID  : {cand3['id']}")
print(f"    First Coord: {geom3['coordinates'][0][0]}")
assert cand3["id"] == cands[2]["id"]
assert geom3 == cands[2]["geometry"]
assert geom3 != geom2 and geom3 != geom1, "PFZ #3 geofence must NOT equal PFZ #1 or PFZ #2 geofence!"
print("    [PASS] TEST 3: Active geofence dynamically updated to PFZ #3's geometry.")

# TEST 4: Switch back to PFZ #1
cand1_again, geom1_again = resolve_map_geofence(cands, cands[0]["id"])
print(f"\n  TEST 4 - Select PFZ #1 Again:")
assert cand1_again["id"] == cands[0]["id"]
assert geom1_again == geom1
print("    [PASS] TEST 4: Active geofence dynamically restored to PFZ #1's geometry.")

print("\n" + "=" * 80)
print("  ALL GEOFENCING RESOLUTION & TRANSITION TESTS PASSED!")
print("=" * 80)
