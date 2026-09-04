"""
ORCA Marine Intelligence Orchestrator
-------------------------------------
Part of the ORCA Marine Intelligence multi-agent system.

Architecture:
                    ORCA ORCHESTRATOR
                           |
        +------------------+------------------+------------------+
        |                  |                  |                  |
        v                  v                  v                  v
      PFZ AGENT      MARINE WEATHER       SVAS AGENT       OCEAN ANALYSIS
                         AGENT                                  AGENT
        |                  |                  |                  |
        +------------------+------------------+------------------+
                           |
                           v
                      RISK AGENT
                           |
                           v
                   FINAL ORCA ASSESSMENT

Responsibilities:
1. Receive vessel parameters (latitude, longitude, date, boat_width_m, natural-language query).
2. Call all four specialist agents independently with structured parameters and resilient error handling.
3. Store complete specialist agent response dictionaries.
4. Pass all four specialist outputs directly into calculate_risk().
5. The deterministic Risk Agent is the authoritative calculator of safety scores and status.
6. Use Gemini to understand the natural-language query and generate a fisherman-friendly answer
   based strictly on the specialist outputs and authoritative Risk Agent result.
7. Assemble and output the complete structured final assessment and human recommendation.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv
from google import genai

from agents.pfz.main import find_nearest_pfz
from agents.marine_weather.main import fetch_marine_weather
from agents.svas.main import get_svas_advisory
from agents.ocean_analysis.main import analyze_ocean_conditions
from agents.risk.main import calculate_risk

# ---------------------------------------------------------------------------
# Logging & Environment Setup
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("orca_orchestrator")

load_dotenv(dotenv_path=".env")

# Initialize Gemini Client if API key is present
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client: Optional[genai.Client] = None

if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as exc:
        logger.warning(f"Could not initialize Gemini client: {exc}")
        gemini_client = None


# ---------------------------------------------------------------------------
# Specialist Agent Invocation with Independent Resilience
# ---------------------------------------------------------------------------

def fetch_pfz_safely(latitude: float, longitude: float) -> Dict[str, Any]:
    """Call PFZ Agent with independent exception handling."""
    try:
        return find_nearest_pfz(latitude=latitude, longitude=longitude)
    except Exception as exc:
        logger.warning(f"PFZ Agent execution failed: {exc}")
        return {
            "agent": "pfz",
            "status": "unavailable",
            "error": str(exc),
        }


def fetch_marine_weather_safely(latitude: float, longitude: float) -> Dict[str, Any]:
    """Call Marine Weather Agent with independent exception handling."""
    try:
        return fetch_marine_weather(latitude=latitude, longitude=longitude)
    except Exception as exc:
        logger.warning(f"Marine Weather Agent execution failed: {exc}")
        return {
            "agent": "marine_weather",
            "status": "unavailable",
            "error": str(exc),
        }


def fetch_svas_safely(
    latitude: float,
    longitude: float,
    date: str,
    boat_width_m: float,
) -> Dict[str, Any]:
    """Call SVAS Agent with independent exception handling."""
    try:
        return get_svas_advisory(
            latitude=latitude,
            longitude=longitude,
            requested_date=date,
            boat_width_m=boat_width_m,
        )
    except Exception as exc:
        logger.warning(f"SVAS Agent execution failed: {exc}")
        return {
            "agent": "svas",
            "status": "unavailable",
            "error": str(exc),
        }


def fetch_ocean_analysis_safely(
    latitude: float,
    longitude: float,
    date: str,
) -> Dict[str, Any]:
    """Call Ocean Analysis Agent with independent exception handling."""
    try:
        return analyze_ocean_conditions(
            latitude=latitude,
            longitude=longitude,
            requested_date=date,
        )
    except Exception as exc:
        logger.warning(f"Ocean Analysis Agent execution failed: {exc}")
        return {
            "agent": "ocean_analysis",
            "status": "unavailable",
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Human-Readable Recommendation Generator
# ---------------------------------------------------------------------------

def build_deterministic_recommendation(
    risk_result: Dict[str, Any],
    pfz_result: Optional[Dict[str, Any]] = None,
    svas_result: Optional[Dict[str, Any]] = None,
    marine_weather_result: Optional[Dict[str, Any]] = None,
    ocean_analysis_result: Optional[Dict[str, Any]] = None,
    query: Optional[str] = None,
) -> str:
    """
    Build a concise, deterministic fisherman-friendly recommendation derived strictly
    from the Risk Agent result and factual specialist evidence.
    """
    status = risk_result.get("status", "UNKNOWN")
    risk_score = risk_result.get("risk_score", "N/A")
    hard_override = risk_result.get("hard_override", False)
    override_reason = risk_result.get("override_reason")
    reasons = risk_result.get("reasons", [])
    data_quality = risk_result.get("data_quality", "unknown")

    lines = []

    if query:
        lines.append(f"Fisherman Question: \"{query}\"\n")

    # 1. Headline Status & Score
    if status == "SAFE":
        lines.append(f"🟢 TRIP RECOMMENDED - SAFE CONDITIONS (Risk Score: {risk_score}/100)")
        lines.append("Marine and weather conditions are favorable for sailing.")
    elif status == "CAUTION":
        lines.append(f"🟡 PROCEED WITH CAUTION (Risk Score: {risk_score}/100)")
        lines.append("Moderate environmental factors detected. Exercise vigilance and monitor local conditions.")
    elif status == "HIGH_RISK":
        lines.append(f"🟠 HIGH RISK - ELEVATED HAZARDS (Risk Score: {risk_score}/100)")
        lines.append("Substantial sea/weather hazards present. Sailing is not advised unless essential with heavy precautions.")
    elif status == "NOT_RECOMMENDED":
        lines.append(f"🔴 NOT RECOMMENDED - DANGEROUS SAILING CONDITIONS (Risk Score: {risk_score}/100)")
        lines.append("Severe marine hazards or official safety directives prohibit safe vessel operations.")
    else:
        lines.append(f"STATUS: {status} (Risk Score: {risk_score}/100)")

    # 2. Hard Override or Primary Reasons
    if hard_override:
        lines.append(f"\n⚠️ CRITICAL SAFETY OVERRIDE: {override_reason}")

    if reasons:
        lines.append("\nKey Risk Factors:")
        for r in reasons[:5]:
            lines.append(f"  • {r}")

    # 3. Marine Weather Summary
    if isinstance(marine_weather_result, dict) and marine_weather_result.get("status") == "success":
        w = marine_weather_result.get("weather", {})
        m = marine_weather_result.get("marine", {})
        lines.append(
            f"\nSea & Weather Conditions: Waves {m.get('wave_height_m', 'N/A')}m (Period: {m.get('wave_period_seconds', 'N/A')}s), "
            f"Wind {w.get('wind_speed_knots', 'N/A')} kt (Gusts: {w.get('wind_gusts_knots', 'N/A')} kt), "
            f"SST {m.get('sea_surface_temperature_c', 'N/A')}°C, Current {m.get('ocean_current_velocity_kmh', 'N/A')} km/h."
        )
    else:
        lines.append("\nSea & Weather Conditions: Live weather data currently unavailable.")

    # 4. SVAS Official Advisory
    if isinstance(svas_result, dict) and svas_result.get("status") == "success":
        adv = svas_result.get("advisory", {})
        area = svas_result.get("area", {})
        lines.append(
            f"\nOfficial INCOIS SVAS Advisory ({area.get('district', 'Local')}, {area.get('state', '')}): "
            f"[{adv.get('severity', '').upper()}] {adv.get('message', '')}"
        )
    else:
        reason_msg = svas_result.get("reason") or svas_result.get("error") if isinstance(svas_result, dict) else "Unavailable"
        lines.append(f"\nOfficial SVAS Advisory: Unavailable ({reason_msg})")

    # 5. Potential Fishing Zone Summary
    if isinstance(pfz_result, dict) and pfz_result.get("status") == "success":
        pfz_info = pfz_result.get("pfz", {}).get("nearest_point", {})
        lines.append(
            f"\nNearest Potential Fishing Zone: {pfz_info.get('distance_km', 'N/A')} km "
            f"towards {pfz_info.get('direction', 'N/A')} (Bearing {pfz_info.get('bearing_degrees', 'N/A')}°)."
        )
    else:
        pfz_err = pfz_result.get("error") or pfz_result.get("reason") if isinstance(pfz_result, dict) else "Unavailable"
        lines.append(f"\nPotential Fishing Zones: Data currently unavailable from INCOIS ({pfz_err}).")

    # 6. Environmental Warnings
    if isinstance(ocean_analysis_result, dict):
        warnings = ocean_analysis_result.get("warnings", [])
        if warnings:
            lines.append("\nActive Environmental Bulletins:")
            for warn in warnings:
                lines.append(f"  • [{warn.get('severity', 'warning').upper()}] {warn.get('message')}")
        else:
            lines.append("\nActive Environmental Bulletins: None reported (No active cyclones or tsunami threats).")

    if data_quality == "insufficient":
        lines.append("\nNote: Assessment formulated with partial data coverage.")

    return "\n".join(lines)


def generate_human_recommendation(
    risk_result: Dict[str, Any],
    pfz_result: Optional[Dict[str, Any]] = None,
    svas_result: Optional[Dict[str, Any]] = None,
    marine_weather_result: Optional[Dict[str, Any]] = None,
    ocean_analysis_result: Optional[Dict[str, Any]] = None,
    query: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    date: Optional[str] = None,
    boat_width_m: Optional[float] = None,
) -> str:
    """
    Generate the final human-readable response answering the fisherman's query.
    If Gemini is available, understand the query and answer directly based ONLY
    on the authoritative Risk Agent assessment and factual specialist outputs.
    """
    fallback_recommendation = build_deterministic_recommendation(
        risk_result=risk_result,
        pfz_result=pfz_result,
        svas_result=svas_result,
        marine_weather_result=marine_weather_result,
        ocean_analysis_result=ocean_analysis_result,
        query=query,
    )

    if not gemini_client:
        return fallback_recommendation

    try:
        status = risk_result.get("status", "UNKNOWN")
        score = risk_result.get("risk_score", 0)

        prompt = f"""
You are the ORCA Marine Intelligence Chatbot and Assistant for coastal fishermen.
A fisherman has asked a question with specific vessel and location parameters.

FISHERMAN'S QUERY:
"{query or 'Is it safe for me to go fishing today? Check everything important and tell me what I should know.'}"

VESSEL & LOCATION CONTEXT:
- Latitude: {latitude}
- Longitude: {longitude}
- Date: {date}
- Boat Width: {boat_width_m} meters

AUTHORITATIVE RISK ASSESSMENT (DETERMINISTIC RISK AGENT):
- Safety Status: {status}
- Risk Score: {score} / 100
- Hard Override Triggered: {risk_result.get('hard_override')} (Reason: {risk_result.get('override_reason')})
- Contributing Reasons: {risk_result.get('reasons')}
- Factor Details: {risk_result.get('factors')}
- Data Quality: {risk_result.get('data_quality')}
- Missing Factors: {risk_result.get('missing_factors')}

SPECIALIST AGENT FINDINGS:
1. Potential Fishing Zone (PFZ Agent):
   - Status: {pfz_result.get('status') if pfz_result else 'unavailable'}
   - Details: {pfz_result.get('pfz') if pfz_result and pfz_result.get('status') == 'success' else pfz_result.get('error') or pfz_result.get('reason') if pfz_result else 'Unavailable'}

2. Marine Weather Agent:
   - Status: {marine_weather_result.get('status') if marine_weather_result else 'unavailable'}
   - Weather: {marine_weather_result.get('weather') if marine_weather_result else 'Unavailable'}
   - Marine/Sea State: {marine_weather_result.get('marine') if marine_weather_result else 'Unavailable'}

3. Small Vessel Advisory Service (SVAS Agent):
   - Status: {svas_result.get('status') if svas_result else 'unavailable'}
   - Advisory: {svas_result.get('advisory') if svas_result and svas_result.get('status') == 'success' else svas_result.get('reason') or svas_result.get('error') if svas_result else 'Unavailable'}
   - Area: {svas_result.get('area') if svas_result and svas_result.get('status') == 'success' else {}}

4. Ocean Analysis Agent (Environmental Hazards):
   - Status: {ocean_analysis_result.get('status') if ocean_analysis_result else 'unavailable'}
   - Source Status: {ocean_analysis_result.get('source_status') if ocean_analysis_result else {}}
   - Environmental Warnings: {ocean_analysis_result.get('warnings') if ocean_analysis_result else []}
   - Tsunami Nearest Event: {ocean_analysis_result.get('tsunami', {}).get('nearest_event') if ocean_analysis_result else None}

STRICT OPERATIONAL RULES:
1. Directly and thoroughly answer the fisherman's specific query in a clear, conversational, and practical tone.
2. The Risk Agent status ({status}) and Risk Score ({score}/100) are AUTHORITATIVE. You MUST NOT calculate, alter, or contradict them.
3. State the trip recommendation clearly at the start based strictly on the status:
   - SAFE: Safe to sail under normal vigilance.
   - CAUTION: Exercise caution; monitor specific highlighted risks.
   - HIGH_RISK: High hazards present; reconsider trip or take extreme precautions.
   - NOT_RECOMMENDED: Unsafe sailing conditions; operations strictly not recommended.
4. Base all statements about PFZ, wind, waves, gusts, currents, SVAS, and hazards STRICTLY on the real specialist agent data above.
5. NEVER invent data or assume calm conditions for missing feeds. If a specialist feed is unavailable (e.g. PFZ error or SVAS unavailable), explicitly tell the fisherman that the information is currently unavailable from official sources.
6. Format your response cleanly with clear headings, bullet points, and practical advice.
"""
        response = gemini_client.interactions.create(
            model="gemini-3.6-flash",
            input=prompt,
        )
        if response and response.output_text and response.output_text.strip():
            return response.output_text.strip()
    except Exception as exc:
        logger.debug(f"Gemini explanation generation fallback due to: {exc}")

    return fallback_recommendation


# ---------------------------------------------------------------------------
# Core Orchestrator Entry Points
# ---------------------------------------------------------------------------

def orchestrate_orca_assessment(
    latitude: float,
    longitude: float,
    date: str,
    boat_width_m: float,
    query: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main Orchestrator pipeline:
    1. Receives structured parameters: latitude, longitude, date, boat_width_m, optional query.
    2. Runs all 4 specialist agents independently with structured parameters.
    3. Feeds complete results into the authoritative Risk Agent (calculate_risk).
    4. Passes query and structured results to Gemini to generate the fisherman's answer.
    5. Assembles and returns the structured final ORCA assessment.
    """
    # 1. Call all four specialist agents using structured parameters
    pfz_result = fetch_pfz_safely(latitude=latitude, longitude=longitude)
    marine_weather_result = fetch_marine_weather_safely(latitude=latitude, longitude=longitude)
    svas_result = fetch_svas_safely(
        latitude=latitude,
        longitude=longitude,
        date=date,
        boat_width_m=boat_width_m,
    )
    ocean_analysis_result = fetch_ocean_analysis_safely(
        latitude=latitude,
        longitude=longitude,
        date=date,
    )

    # 2. Authoritative Risk Agent calculation
    risk_result = calculate_risk(
        latitude=latitude,
        longitude=longitude,
        date=date,
        boat_width_m=boat_width_m,
        pfz_result=pfz_result,
        marine_weather_result=marine_weather_result,
        svas_result=svas_result,
        ocean_analysis_result=ocean_analysis_result,
    )

    # 3. Generate human recommendation / answer derived strictly from Risk Agent & Specialist data
    recommendation = generate_human_recommendation(
        risk_result=risk_result,
        pfz_result=pfz_result,
        svas_result=svas_result,
        marine_weather_result=marine_weather_result,
        ocean_analysis_result=ocean_analysis_result,
        query=query,
        latitude=latitude,
        longitude=longitude,
        date=date,
        boat_width_m=boat_width_m,
    )

    # 4. Final structured response
    final_assessment: Dict[str, Any] = {
        "orchestrator": "ORCA Marine Intelligence Orchestrator",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input": {
            "latitude": latitude,
            "longitude": longitude,
            "date": date,
            "boat_width_m": boat_width_m,
            "query": query,
        },
        "pfz": pfz_result,
        "marine_weather": marine_weather_result,
        "svas": svas_result,
        "ocean_analysis": ocean_analysis_result,
        "risk": risk_result,
        "recommendation": recommendation,
    }

    return final_assessment


def run_orca(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    date: Optional[str] = None,
    boat_width_m: Optional[float] = None,
    query: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Flexible entry point for ORCA orchestrator supporting direct arguments
    or natural language query inputs.
    """
    # Natural language query parsing if string passed as first positional parameter
    if isinstance(latitude, str) and longitude is None:
        query_text = latitude
        query = query_text

        # Extract latitude / longitude if present in string
        lat_match = re.search(r"lat(?:itude)?\s*[:=]?\s*(-?\d+\.?\d*)", query_text, re.IGNORECASE)
        lon_match = re.search(r"lon(?:gitude)?\s*[:=]?\s*(-?\d+\.?\d*)", query_text, re.IGNORECASE)
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", query_text)
        width_match = re.search(r"(?:boat\s*width|width)\s*[:=]?\s*(\d+\.?\d*)", query_text, re.IGNORECASE)

        lat_val = float(lat_match.group(1)) if lat_match else 19.72
        lon_val = float(lon_match.group(1)) if lon_match else 72.70
        date_val = date_match.group(1) if date_match else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        width_val = float(width_match.group(1)) if width_match else 5.0
    else:
        lat_val = float(latitude) if latitude is not None else 19.72
        lon_val = float(longitude) if longitude is not None else 72.70
        date_val = date if date is not None else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        width_val = float(boat_width_m) if boat_width_m is not None else 5.0

    return orchestrate_orca_assessment(
        latitude=lat_val,
        longitude=lon_val,
        date=date_val,
        boat_width_m=width_val,
        query=query,
    )


# ---------------------------------------------------------------------------
# CLI Test Runner
# ---------------------------------------------------------------------------

def print_cli_test_output(
    latitude: float,
    longitude: float,
    date: str,
    boat_width_m: float,
    query: Optional[str],
    assessment: Dict[str, Any],
) -> None:
    """Print complete structured CLI test output as specified."""
    pfz = assessment.get("pfz", {})
    weather = assessment.get("marine_weather", {})
    svas = assessment.get("svas", {})
    ocean = assessment.get("ocean_analysis", {})
    risk = assessment.get("risk", {})

    print("\n" + "=" * 60)
    print("             ORCA ORCHESTRATOR LIVE TEST")
    print("=" * 60)

    print("\nINPUT")
    print("-" * 60)
    print(f"Latitude: {latitude}")
    print(f"Longitude: {longitude}")
    print(f"Date: {date}")
    print(f"Boat Width: {boat_width_m} m")
    if query:
        print(f"Query: {query}")

    print("\n" + "=" * 60)
    print("PFZ AGENT")
    print("=" * 60)
    print(f"Status: {pfz.get('status')}")
    if pfz.get("status") == "success":
        nearest_pt = pfz.get("pfz", {}).get("nearest_point", {})
        pfz_meta = pfz.get("pfz", {})
        print(f"Nearest PFZ Distance: {nearest_pt.get('distance_km')} km")
        print(f"Direction / Bearing: {nearest_pt.get('direction')} ({nearest_pt.get('bearing_degrees')}°)")
        print(f"Nearest Point Coordinates: ({nearest_pt.get('latitude')}, {nearest_pt.get('longitude')})")
        print(f"Category: {pfz_meta.get('category')}")
        print(f"Year / Julian Day: {pfz_meta.get('data_year')} / {pfz_meta.get('julian_day')}")
        print(f"UID / SNO: {pfz_meta.get('uid')} / {pfz_meta.get('sno')}")
    else:
        print(f"Error/Reason: {pfz.get('error') or pfz.get('reason') or 'PFZ data unavailable'}")

    print("\n" + "=" * 60)
    print("MARINE WEATHER AGENT")
    print("=" * 60)
    print(f"Status: {weather.get('status')}")
    if weather.get("status") == "success":
        w = weather.get("weather", {})
        m = weather.get("marine", {})
        print(f"Air Temperature: {w.get('temperature_c')} °C")
        print(f"Relative Humidity: {w.get('relative_humidity_percent')} %")
        print(f"Precipitation: {w.get('precipitation_mm')} mm")
        print(f"Wind Speed: {w.get('wind_speed_knots')} knots")
        print(f"Wind Gusts: {w.get('wind_gusts_knots')} knots")
        print(f"Wind Direction: {w.get('wind_direction_degrees')}°")
        print(f"Wave Height: {m.get('wave_height_m')} m")
        print(f"Wave Period: {m.get('wave_period_seconds')} s")
        print(f"Wave Direction: {m.get('wave_direction_degrees')}°")
        print(f"Sea Surface Temp: {m.get('sea_surface_temperature_c')} °C")
        print(f"Ocean Current Velocity: {m.get('ocean_current_velocity_kmh')} km/h")
        print(f"Ocean Current Direction: {m.get('ocean_current_direction_degrees')}°")
    else:
        print(f"Error: {weather.get('error', 'Marine weather data unavailable')}")

    print("\n" + "=" * 60)
    print("SVAS AGENT")
    print("=" * 60)
    print(f"Status: {svas.get('status')}")
    if svas.get("status") == "success":
        area = svas.get("area", {})
        vessel = svas.get("vessel", {})
        adv = svas.get("advisory", {})
        print(f"District / State: {area.get('district')}, {area.get('state')}")
        print(f"Applicable Vessel Category: {vessel.get('applicable_category')}")
        print(f"Advisory Day / Date: {adv.get('day')} ({adv.get('date')})")
        print(f"Severity: {adv.get('severity')}")
        print(f"Advisory Message: {adv.get('message')}")
    else:
        print(f"Reason: {svas.get('reason') or svas.get('error') or 'No SVAS advisory available for location/date'}")

    print("\n" + "=" * 60)
    print("OCEAN ANALYSIS AGENT")
    print("=" * 60)
    print(f"Status: {ocean.get('status')}")
    src_stat = ocean.get("source_status", {})
    print(f"Sources: Chlorophyll={src_stat.get('chlorophyll')}, Cyclone={src_stat.get('cyclone')}, "
          f"Lightning={src_stat.get('lightning')}, Tsunami={src_stat.get('tsunami')}")
    warnings = ocean.get("warnings", [])
    print(f"Hazard Warnings Count: {len(warnings)}")
    for w in warnings:
        print(f"  - [{w.get('severity', '').upper()}] {w.get('message')}")

    print("\n" + "=" * 60)
    print("RISK AGENT")
    print("=" * 60)
    print(f"Risk Score: {risk.get('risk_score')} / 100")
    print(f"Status: {risk.get('status')}")
    print(f"Data Quality: {risk.get('data_quality')}")
    print(f"Hard Override: {risk.get('hard_override')}")
    if risk.get("hard_override"):
        print(f"Override Reason: {risk.get('override_reason')}")

    print("\nFactors:")
    factors = risk.get("factors", [])
    if factors:
        for f in factors:
            print(f"  - {f.get('factor')}: value={f.get('value')} {f.get('unit') or ''}, "
                  f"risk={f.get('risk')}, weight={f.get('weight')}, contribution={f.get('contribution')}")
    else:
        print("  (None / Hard Override Triggered)")

    print("\nReasons:")
    reasons = risk.get("reasons", [])
    if reasons:
        for r in reasons:
            print(f"  • {r}")
    else:
        print("  (None)")

    print(f"\nMissing Factors: {risk.get('missing_factors') or 'None'}")
    print(f"Source Status: {risk.get('source_status')}")

    print("\n" + "=" * 60)
    print("ORCA CHATBOT RESPONSE (ANSWER TO FISHERMAN'S QUERY)")
    print("=" * 60)
    print(assessment.get("recommendation"))

    print("\n" + "=" * 60)
    print("FINAL ORCA ASSESSMENT (STRUCTURED JSON)")
    print("=" * 60)
    print(json.dumps(assessment, indent=2, default=str))


def main():
    """Interactive CLI test mode for ORCA Orchestrator."""
    try:
        lat_str = input("Latitude: ").strip()
        latitude = float(lat_str) if lat_str else 19.72
    except (ValueError, EOFError):
        latitude = 19.72

    try:
        lon_str = input("Longitude: ").strip()
        longitude = float(lon_str) if lon_str else 72.70
    except (ValueError, EOFError):
        longitude = 72.70

    try:
        date_str = input("Date (YYYY-MM-DD): ").strip()
        date_val = date_str if date_str else "2026-09-04"
    except (ValueError, EOFError):
        date_val = "2026-09-04"

    try:
        width_str = input("Boat width (meters): ").strip()
        boat_width_m = float(width_str) if width_str else 5.0
    except (ValueError, EOFError):
        boat_width_m = 5.0

    try:
        query_str = input("Your query: ").strip()
        query = query_str if query_str else None
    except (ValueError, EOFError):
        query = None

    assessment = orchestrate_orca_assessment(
        latitude=latitude,
        longitude=longitude,
        date=date_val,
        boat_width_m=boat_width_m,
        query=query,
    )

    print_cli_test_output(
        latitude=latitude,
        longitude=longitude,
        date=date_val,
        boat_width_m=boat_width_m,
        query=query,
        assessment=assessment,
    )


if __name__ == "__main__":
    main()