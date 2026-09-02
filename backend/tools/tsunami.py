import requests
import math

URL = "https://gemini.incois.gov.in/api/ws/tsunami"


# ============================================================
# HAVERSINE DISTANCE
# ============================================================

def calculate_distance_km(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two geographic coordinates.
    """

    R = 6371.0  # Earth radius in km

    lat1 = math.radians(float(lat1))
    lon1 = math.radians(float(lon1))
    lat2 = math.radians(float(lat2))
    lon2 = math.radians(float(lon2))

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return R * c


# ============================================================
# FETCH TSUNAMI DATA
# ============================================================

def get_tsunami_data():

    try:

        response = requests.get(
            URL,
            timeout=30,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            }
        )

        response.raise_for_status()

        data = response.json()

        # Validate GeoJSON
        if data.get("type") != "FeatureCollection":
            raise ValueError(
                "Unexpected response format"
            )

        features = data.get("features", [])

        tsunami_events = []

        for feature in features:

            properties = feature.get(
                "properties", {}
            )

            geometry = feature.get(
                "geometry", {}
            )

            coordinates = geometry.get(
                "coordinates", []
            )

            # ------------------------------------------------
            # Get latitude / longitude
            # ------------------------------------------------

            longitude = properties.get("LONGITUDE")
            latitude = properties.get("LATITUDE")

            # Prefer GeoJSON geometry coordinates
            if len(coordinates) >= 2:

                longitude = coordinates[0]
                latitude = coordinates[1]

            # Skip event if coordinates unavailable
            if latitude is None or longitude is None:
                continue

            try:
                latitude = float(latitude)
                longitude = float(longitude)

            except (TypeError, ValueError):
                continue

            # ------------------------------------------------
            # Create event
            # ------------------------------------------------

            event = {

                "event_id":
                    properties.get("EVID"),

                "bulletin_type":
                    properties.get("BTYPE"),

                "bulletin_number":
                    properties.get("BULNO"),

                "magnitude":
                    properties.get("MAGNITUDE"),

                "origin_time":
                    properties.get("ORIGINTIME")
                    or properties.get("OT"),

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "depth_km":
                    properties.get("DEPTH"),

                "ocean_land":
                    properties.get("OCEAN_LAND"),

                "region":
                    properties.get("REGIONNAME"),

                "evaluation":
                    properties.get("EVALUATION"),

                "detail_url":
                    properties.get("detail")
            }

            tsunami_events.append(event)

        return tsunami_events

    except requests.exceptions.RequestException as e:

        print(
            f"INCOIS request failed: {e}"
        )

        return []

    except ValueError as e:

        print(
            f"Invalid response: {e}"
        )

        return []


# ============================================================
# LOCATION BASED TSUNAMI DATA
# ============================================================

def get_location_based_tsunami(
    user_lat,
    user_lon,
    radius_km=1000
):

    # Get all INCOIS events
    events = get_tsunami_data()

    nearby_events = []

    for event in events:

        event_lat = event["latitude"]
        event_lon = event["longitude"]

        # Calculate distance
        distance = calculate_distance_km(
            user_lat,
            user_lon,
            event_lat,
            event_lon
        )

        # Add distance to event
        event["distance_km"] = round(
            distance,
            2
        )

        # Keep only events inside radius
        if distance <= radius_km:

            nearby_events.append(event)

    # Sort nearest event first
    nearby_events.sort(
        key=lambda x: x["distance_km"]
    )

    return nearby_events


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("=" * 70)
    print("INCOIS LOCATION-BASED TSUNAMI DATA")
    print("=" * 70)

    # --------------------------------------------------------
    # USER LOCATION
    # --------------------------------------------------------

    # Example: Mumbai
    USER_LAT = 19.0760
    USER_LON = 72.8777

    # Search radius
    RADIUS_KM = 1000

    print("\nUser Location")
    print("-" * 70)

    print(f"Latitude  : {USER_LAT}")
    print(f"Longitude : {USER_LON}")
    print(f"Radius    : {RADIUS_KM} km")

    # --------------------------------------------------------
    # GET LOCATION-BASED EVENTS
    # --------------------------------------------------------

    events = get_location_based_tsunami(
        USER_LAT,
        USER_LON,
        RADIUS_KM
    )

    print("\n" + "=" * 70)
    print(
        f"Nearby Events: {len(events)}"
    )
    print("=" * 70)

    # --------------------------------------------------------
    # DISPLAY RESULTS
    # --------------------------------------------------------

    if not events:

        print(
            f"\nNo INCOIS tsunami/earthquake "
            f"events found within {RADIUS_KM} km."
        )

    else:

        for i, event in enumerate(
            events,
            start=1
        ):

            print("\n" + "-" * 70)

            print(
                f"Event #{i}"
            )

            print(
                f"Event ID       : "
                f"{event['event_id']}"
            )

            print(
                f"Region         : "
                f"{event['region']}"
            )

            print(
                f"Magnitude      : "
                f"{event['magnitude']}"
            )

            print(
                f"Origin Time    : "
                f"{event['origin_time']}"
            )

            print(
                f"Latitude       : "
                f"{event['latitude']}"
            )

            print(
                f"Longitude      : "
                f"{event['longitude']}"
            )

            print(
                f"Distance       : "
                f"{event['distance_km']} km"
            )

            print(
                f"Depth (km)     : "
                f"{event['depth_km']}"
            )

            print(
                f"Ocean/Land     : "
                f"{event['ocean_land']}"
            )

            print(
                f"Bulletin Type  : "
                f"{event['bulletin_type']}"
            )

            print(
                f"Bulletin No.   : "
                f"{event['bulletin_number']}"
            )

            print(
                f"Tsunami Status : "
                f"{event['evaluation']}"
            )

            print(
                f"Details        : "
                f"{event['detail_url']}"
            )