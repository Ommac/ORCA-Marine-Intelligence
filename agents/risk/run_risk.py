"""
ORCA Live Risk Pipeline Runner
------------------------------
Real live end-to-end runner that fetches live data from all four ORCA specialist agents:
1. PFZ Agent (find_nearest_pfz)
2. Marine Weather Agent (fetch_marine_weather)
3. SVAS Agent (get_svas_advisory)
4. Ocean Analysis Agent (analyze_ocean_conditions)

And calculates the final deterministic risk score via Risk Agent (calculate_risk).

Usage:
    python3 -m agents.risk.run_risk
"""

import json
import sys
from datetime import datetime

from agents.pfz.main import find_nearest_pfz
from agents.marine_weather.main import fetch_marine_weather
from agents.svas.main import get_svas_advisory
from agents.ocean_analysis.main import analyze_ocean_conditions
from agents.risk.main import calculate_risk


def prompt_user_input() -> tuple[float, float, str, float]:
    """Prompt and validate user inputs for location, date, and boat dimensions."""
    print("============================================================")
    print("                 ORCA LIVE RISK PIPELINE")
    print("============================================================")
    
    # Latitude
    while True:
        raw_lat = input("Latitude: ").strip()
        try:
            lat = float(raw_lat)
            if not (-90.0 <= lat <= 90.0):
                print("Error: Latitude must be between -90 and 90.")
                continue
            break
        except ValueError:
            print("Error: Please enter a valid numeric latitude.")

    # Longitude
    while True:
        raw_lon = input("Longitude: ").strip()
        try:
            lon = float(raw_lon)
            if not (-180.0 <= lon <= 180.0):
                print("Error: Longitude must be between -180 and 180.")
                continue
            break
        except ValueError:
            print("Error: Please enter a valid numeric longitude.")

    # Date
    while True:
        raw_date = input("Date (YYYY-MM-DD): ").strip()
        try:
            datetime.strptime(raw_date, "%Y-%m-%d")
            date_str = raw_date
            break
        except ValueError:
            print("Error: Date must be in YYYY-MM-DD format.")

    # Boat width
    while True:
        raw_width = input("Boat width (meters): ").strip()
        try:
            width = float(raw_width)
            if width <= 0:
                print("Error: Boat width must be greater than 0.")
                continue
            break
        except ValueError:
            print("Error: Please enter a valid numeric boat width in meters.")

    return lat, lon, date_str, width


def run_live_pipeline():
    lat, lon, req_date, boat_width_m = prompt_user_input()

    print("\nINPUT")
    print("------------------------------------------------------------")
    print(f"Latitude      : {lat}")
    print(f"Longitude     : {lon}")
    print(f"Date          : {req_date}")
    print(f"Boat Width    : {boat_width_m} m")

    # ============================================================
    # 1. PFZ AGENT
    # ============================================================
    print("\n" + "=" * 60)
    print("                    PFZ AGENT")
    print("=" * 60)
    pfz_result = None
    try:
        pfz_result = find_nearest_pfz(latitude=lat, longitude=lon)
        status = pfz_result.get("status", "unknown")
        print(f"Status        : {status}")
        
        nearest = pfz_result.get("nearest_pfz") or {}
        if nearest:
            np = nearest.get("nearest_point") or {}
            print(f"Nearest PFZ   : ({np.get('latitude')}, {np.get('longitude')})")
            print(f"Distance      : {nearest.get('distance_km')} km")
            print(f"Direction     : {nearest.get('direction')} ({nearest.get('bearing_degrees')}°)")
            print(f"PFZ Category  : {nearest.get('category')}")
        else:
            print("Nearest PFZ   : No PFZ features within search radius")

        source_info = pfz_result.get("source") or {}
        if isinstance(source_info, dict):
            print(f"Source        : {source_info.get('provider')} ({source_info.get('layer')})")
        else:
            print(f"Source        : {source_info}")
        
        freshness = pfz_result.get("freshness") or {}
        print(f"Freshness     : Advisory Year {freshness.get('advisory_year')}, Julian Day {freshness.get('advisory_julian_day')} (Fetched: {freshness.get('fetched_at')})")

    except Exception as exc:
        print(f"[ERROR] PFZ Agent failed: {exc}")
        pfz_result = {"agent": "pfz", "status": "unavailable", "error": str(exc)}

    # ============================================================
    # 2. MARINE WEATHER AGENT
    # ============================================================
    print("\n" + "=" * 60)
    print("              MARINE WEATHER AGENT")
    print("=" * 60)
    marine_weather_result = None
    try:
        marine_weather_result = fetch_marine_weather(latitude=lat, longitude=lon)
        status = marine_weather_result.get("status", "unknown")
        print(f"Status        : {status}")

        weather = marine_weather_result.get("weather") or {}
        marine = marine_weather_result.get("marine") or {}

        print(f"Wind Speed    : {weather.get('wind_speed_knots')} kt")
        print(f"Wind Gusts    : {weather.get('wind_gusts_knots')} kt")
        print(f"Wave Height   : {marine.get('wave_height_m')} m")
        print(f"Wave Period   : {marine.get('wave_period_seconds')} s")
        print(f"Current Speed : {marine.get('ocean_current_velocity_kmh')} km/h")
        print(f"Current Dir   : {marine.get('ocean_current_direction_degrees')}°")
        print(f"SST           : {marine.get('sea_surface_temperature_c')} °C")

        source = marine_weather_result.get("source") or {}
        print(f"Source        : {source.get('weather_provider')} / {source.get('marine_provider')}")

    except Exception as exc:
        print(f"[ERROR] Marine Weather Agent failed: {exc}")
        marine_weather_result = {"agent": "marine_weather", "status": "unavailable", "error": str(exc)}

    # ============================================================
    # 3. SVAS AGENT
    # ============================================================
    print("\n" + "=" * 60)
    print("                    SVAS AGENT")
    print("=" * 60)
    svas_result = None
    try:
        svas_result = get_svas_advisory(
            latitude=lat,
            longitude=lon,
            requested_date=req_date,
            boat_width_m=boat_width_m
        )
        status = svas_result.get("status", "unknown")
        print(f"Status        : {status}")

        vessel = svas_result.get("vessel") or {}
        area = svas_result.get("area") or {}
        advisory = svas_result.get("advisory") or {}
        source = svas_result.get("source") or {}

        print(f"Boat Category : {vessel.get('applicable_category')}")
        print(f"District/State: {area.get('district')}, {area.get('state')}")
        print(f"Advisory Day  : {advisory.get('day')} ({advisory.get('date')})")
        print(f"Severity      : {advisory.get('severity')}")
        print(f"Advisory Msg  : {advisory.get('message')}")
        print(f"Source        : {source.get('provider')} ({source.get('service')})")

    except Exception as exc:
        print(f"[ERROR] SVAS Agent failed: {exc}")
        svas_result = {"agent": "svas", "status": "unavailable", "error": str(exc)}

    # ============================================================
    # 4. OCEAN ANALYSIS AGENT
    # ============================================================
    print("\n" + "=" * 60)
    print("              OCEAN ANALYSIS AGENT")
    print("=" * 60)
    ocean_analysis_result = None
    try:
        ocean_analysis_result = analyze_ocean_conditions(
            latitude=lat,
            longitude=lon,
            requested_date=req_date
        )
        status = ocean_analysis_result.get("status", "unknown")
        print(f"Status        : {status}")

        cyclone = ocean_analysis_result.get("cyclone") or {}
        tsunami = ocean_analysis_result.get("tsunami") or {}
        lightning = ocean_analysis_result.get("lightning") or {}
        warnings = ocean_analysis_result.get("warnings") or []
        src_status = ocean_analysis_result.get("source_status") or {}
        freshness = ocean_analysis_result.get("freshness") or {}

        print(f"Cyclone Status: {'Available' if cyclone.get('available') else 'Unavailable'} ({cyclone.get('reason') or 'OK'})")
        print(f"Tsunami Status: {'Available' if tsunami.get('available') else 'Unavailable'} ({tsunami.get('reason') or f'{tsunami.get('events_in_search_radius', 0)} events in search radius'})")
        
        l_data = lightning.get("data") or {}
        print(f"Convective/LTG: {'Active' if l_data.get('thunderstorm_active') else ('Elevated' if l_data.get('elevated_convective_risk') else 'Clear')} (Source: {lightning.get('source')})")

        print(f"Warnings      : {len(warnings)} warning(s)")
        for w in warnings:
            print(f"  - [{w.get('severity', '').upper()}] {w.get('message')}")

        print(f"Source Status : {src_status}")
        print(f"Freshness     : Query TS: {freshness.get('query_timestamp')}")

    except Exception as exc:
        print(f"[ERROR] Ocean Analysis Agent failed: {exc}")
        ocean_analysis_result = {"agent": "ocean_analysis", "status": "unavailable", "error": str(exc)}

    # ============================================================
    # 5. RISK AGENT
    # ============================================================
    print("\n" + "=" * 60)
    print("                    RISK AGENT")
    print("=" * 60)
    risk_result = calculate_risk(
        latitude=lat,
        longitude=lon,
        date=req_date,
        boat_width_m=boat_width_m,
        pfz_result=pfz_result,
        marine_weather_result=marine_weather_result,
        svas_result=svas_result,
        ocean_analysis_result=ocean_analysis_result,
    )

    print(f"Risk Score    : {risk_result.get('risk_score')}/100")
    print(f"Status        : {risk_result.get('status')}")
    print(f"Data Quality  : {risk_result.get('data_quality')}")
    print(f"Hard Override : {risk_result.get('hard_override')}")
    if risk_result.get("hard_override"):
        print(f"Override Reason: {risk_result.get('override_reason')}")

    factors = risk_result.get("factors") or []
    if factors:
        print("\nFactors:")
        print(f"{'Factor':<22} {'Value':<12} {'Risk':<8} {'Weight':<8} {'Contribution':<12}")
        print("-" * 62)
        for f in factors:
            val_str = f"{f.get('value')} {f.get('unit')}" if f.get('value') is not None else "N/A"
            print(f"{f.get('factor'):<22} {val_str:<12} {f.get('risk', 0):<8} {f.get('weight', 0):<8.2f} {f.get('contribution', 0):<12.2f}")

    reasons = risk_result.get("reasons") or []
    print("\nReasons:")
    for r in reasons:
        print(f"- {r}")

    missing = risk_result.get("missing_factors") or []
    if missing:
        print(f"\nMissing Factors: {', '.join(missing)}")
    else:
        print("\nMissing Factors: None")

    print(f"Source Status  : {risk_result.get('source_status')}")

    # ============================================================
    # FINAL ORCA ASSESSMENT
    # ============================================================
    print("\n" + "=" * 60)
    print("                 FINAL ORCA ASSESSMENT")
    print("=" * 60)

    final_status = risk_result.get("status")
    final_score = risk_result.get("risk_score")

    print(f"STATUS    : {final_status}")
    print(f"RISK SCORE: {final_score}/100")
    print("\nRECOMMENDATION:")
    
    if risk_result.get("hard_override"):
        print(f"CRITICAL SAFETY OVERRIDE: Voyage NOT RECOMMENDED. Reason: {reasons[0] if reasons else risk_result.get('override_reason')}")
    elif final_status == "SAFE":
        print("Conditions are favorable for fishing operations. Sea and atmospheric conditions are within normal safe operational limits.")
    elif final_status == "CAUTION":
        print("Exercise caution during fishing operations. Moderate environmental factors present; monitor local conditions closely.")
    elif final_status == "HIGH_RISK":
        print("High environmental risk detected. Operations should be restricted to experienced crews with well-equipped vessels.")
    else:
        print("Voyage NOT RECOMMENDED due to high cumulative environmental risk and sea hazards.")

    # ============================================================
    # COMPLETE RESULT JSON
    # ============================================================
    print("\n" + "=" * 60)
    print("                COMPLETE RESULT JSON")
    print("=" * 60)
    print(json.dumps(risk_result, indent=2, default=str))


if __name__ == "__main__":
    run_live_pipeline()
