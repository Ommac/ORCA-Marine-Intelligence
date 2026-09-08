"""
Risk Agent - Specialist Agent #5 (Synthesis)
--------------------------------------------
Part of the ORCA Marine Intelligence multi-agent system.

Responsibility:
Receives already-computed outputs from the four specialist agents:
1. PFZ Agent (context only - not a safety risk factor)
2. Marine Weather Agent (wave height, wind speed, wind gusts, ocean current)
3. SVAS Agent (authoritative INCOIS Small Vessel Advisory Service signal)
4. Ocean Analysis Agent (cyclone, tsunami, convective lightning, other hazards)

Produces a deterministic, explainable 0–100 ORCA safety and risk assessment.
Does NOT use an LLM or ML model. Strictly deterministic Python rules.

Public Entry Point:
    calculate_risk(
        latitude: float,
        longitude: float,
        date: str,
        boat_width_m: float,
        pfz_result: Optional[dict] = None,
        marine_weather_result: Optional[dict] = None,
        svas_result: Optional[dict] = None,
        ocean_analysis_result: Optional[dict] = None,
    ) -> dict
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Base Weight Configuration
# ---------------------------------------------------------------------------

BASE_WEIGHTS = {
    "wave_height": 0.30,
    "wind_speed": 0.20,
    "wind_gusts": 0.15,
    "ocean_current": 0.15,
    "lightning_convective": 0.10,
    "other_ocean_hazard": 0.10,
}


# ---------------------------------------------------------------------------
# Status Classification
# ---------------------------------------------------------------------------

def classify_status(score: int) -> str:
    """
    Map 0-100 risk score to ORCA status band:
    0-29   -> SAFE
    30-59  -> CAUTION
    60-79  -> HIGH_RISK
    80-100 -> NOT_RECOMMENDED
    """
    if score <= 29:
        return "SAFE"
    elif score <= 59:
        return "CAUTION"
    elif score <= 79:
        return "HIGH_RISK"
    else:
        return "NOT_RECOMMENDED"


# ---------------------------------------------------------------------------
# Component Risk Evaluators
# ---------------------------------------------------------------------------

def calculate_wave_risk(wave_height_m: Optional[float]) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate wave height risk:
    < 1.0 m      -> 0
    1.0 - <2.0 m -> 35
    2.0 - <3.0 m -> 70
    >= 3.0 m     -> 100
    """
    if wave_height_m is None or not isinstance(wave_height_m, (int, float)) or math.isnan(wave_height_m):
        return None, None

    val = float(wave_height_m)
    if val < 1.0:
        return 0, f"Wave height is {val:.1f} m (calm/low sea)."
    elif val < 2.0:
        return 35, f"Wave height is {val:.1f} m, contributing moderate wave risk."
    elif val < 3.0:
        return 70, f"Wave height is {val:.1f} m, contributing high wave risk."
    else:
        return 100, f"Wave height is {val:.1f} m, indicating severe wave hazard."


def calculate_wind_risk(wind_speed_kt: Optional[float]) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate wind speed risk:
    < 10 kt      -> 0
    10 - <20 kt  -> 30
    20 - <30 kt  -> 70
    >= 30 kt     -> 100
    """
    if wind_speed_kt is None or not isinstance(wind_speed_kt, (int, float)) or math.isnan(wind_speed_kt):
        return None, None

    val = float(wind_speed_kt)
    if val < 10.0:
        return 0, f"Sustained wind speed is {val:.1f} kt (light breeze)."
    elif val < 20.0:
        return 30, f"Sustained wind speed is {val:.1f} kt, contributing moderate risk."
    elif val < 30.0:
        return 70, f"Sustained wind speed is {val:.1f} kt, contributing high risk."
    else:
        return 100, f"Sustained wind speed is {val:.1f} kt, indicating severe gale/storm winds."


def calculate_gust_risk(wind_gust_kt: Optional[float]) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate wind gust risk:
    < 15 kt      -> 0
    15 - <25 kt  -> 30
    25 - <35 kt  -> 70
    >= 35 kt     -> 100
    """
    if wind_gust_kt is None or not isinstance(wind_gust_kt, (int, float)) or math.isnan(wind_gust_kt):
        return None, None

    val = float(wind_gust_kt)
    if val < 15.0:
        return 0, f"Wind gusts are {val:.1f} kt (low gustiness)."
    elif val < 25.0:
        return 30, f"Wind gusts are {val:.1f} kt, contributing moderate risk."
    elif val < 35.0:
        return 70, f"Wind gusts are {val:.1f} kt, contributing high risk."
    else:
        return 100, f"Wind gusts reach {val:.1f} kt, indicating dangerous squall conditions."


def calculate_current_risk(current_kmh: Optional[float]) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate ocean current velocity risk:
    < 1.0 km/h     -> 0
    1.0 - <2.0 km/h -> 30
    2.0 - <3.0 km/h -> 70
    >= 3.0 km/h    -> 100
    """
    if current_kmh is None or not isinstance(current_kmh, (int, float)) or math.isnan(current_kmh):
        return None, None

    val = float(current_kmh)
    if val < 1.0:
        return 0, f"Ocean current velocity is {val:.1f} km/h (mild current)."
    elif val < 2.0:
        return 30, f"Ocean current velocity is {val:.1f} km/h, contributing moderate drift risk."
    elif val < 3.0:
        return 70, f"Ocean current velocity is {val:.1f} km/h, contributing strong drift risk."
    else:
        return 100, f"Ocean current velocity is {val:.1f} km/h, indicating dangerous rip/drift current."


def calculate_lightning_risk(
    ocean_analysis: Optional[Dict[str, Any]],
    marine_weather: Optional[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate convective and lightning risk:
    No elevated convective risk          -> 0
    Elevated convective risk             -> 50
    Active thunderstorm/lightning state  -> 100
    """
    # 1. Check Ocean Analysis lightning source if available
    if isinstance(ocean_analysis, dict) and ocean_analysis.get("status") in ["success", "partial"]:
        lightning_sec = ocean_analysis.get("lightning") or {}
        if lightning_sec.get("available"):
            l_data = lightning_sec.get("data") or {}
            is_active = bool(l_data.get("thunderstorm_active"))
            is_elevated = bool(l_data.get("elevated_convective_risk") or l_data.get("thunderstorm_forecast_today"))
            w_desc = l_data.get("weather_description") or "Thunderstorm"

            if is_active:
                return 100, f"Active thunderstorm/lightning condition detected ({w_desc})."
            elif is_elevated:
                cape_data = l_data.get("convective_available_potential_energy_j_kg") or {}
                max_cape = cape_data.get("max_cape", 0)
                return 50, f"Elevated convective potential energy detected (Max CAPE: {max_cape} J/kg)."
            else:
                return 0, "No elevated convective lightning risk detected."

    # 2. Check Ocean Analysis warnings for thunderstorm / lightning mentions
    if isinstance(ocean_analysis, dict) and ocean_analysis.get("warnings"):
        for w in ocean_analysis.get("warnings") or []:
            w_type = str(w.get("type", "")).lower()
            w_msg = str(w.get("message", "")).lower()
            if any(term in w_type or term in w_msg for term in ["thunderstorm", "lightning", "squall", "convective"]):
                sev = str(w.get("severity", "")).lower()
                if sev in ["high", "critical", "severe", "alert", "danger"]:
                    return 100, f"Active thunderstorm/lightning warning: {w.get('message', 'Dangerous squall activity.')}"
                elif sev in ["medium", "moderate", "caution", "warning"]:
                    return 50, f"Elevated convective storm advisory: {w.get('message', 'Convective instability.')}"

    # 3. Secondary check via Marine Weather weather codes if ocean analysis lightning unavailable
    if isinstance(marine_weather, dict):
        weather_sec = marine_weather.get("weather") or {}
        code = weather_sec.get("weather_code")
        if code in [95, 96, 99]:
            return 100, f"Active thunderstorm detected from weather observations (code {code})."
        elif code in [80, 81, 82]:
            return 50, f"Rain shower activity detected (code {code}), indicating possible convective instability."
        elif code is not None:
            return 0, "No active thunderstorm observed in weather report."

    # If neither source provided convective info
    return None, None


def calculate_other_ocean_risk(
    ocean_analysis: Optional[Dict[str, Any]],
) -> Tuple[Optional[int], Optional[str]]:
    """
    Evaluate other ocean hazards from Ocean Analysis warnings:
    No relevant hazard                 -> 0
    Elevated/uncertain relevant hazard -> 50
    Active dangerous hazard            -> 100
    """
    if not isinstance(ocean_analysis, dict):
        return None, None

    # If ocean analysis is completely unavailable / error
    if ocean_analysis.get("status") == "unavailable" and not ocean_analysis.get("warnings"):
        return None, None

    warnings = ocean_analysis.get("warnings") or []
    if not warnings:
        return 0, "No additional ocean hazards or environmental warnings reported."

    severities = [str(w.get("severity", "")).lower() for w in warnings]
    if "critical" in severities or "high" in severities:
        return 100, f"Active ocean hazard warnings present ({len(warnings)} warning(s))."
    elif "moderate" in severities or "medium" in severities:
        return 50, f"Elevated ocean hazard advisories present ({len(warnings)} warning(s))."
    else:
        return 0, "Minor ocean advisories noted without safety impediment."


# ---------------------------------------------------------------------------
# Step 1: Hard Safety Overrides Evaluator
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Step 1: Hard Safety Overrides Evaluator
# ---------------------------------------------------------------------------

def evaluate_hard_safety_overrides(
    svas_result: Optional[Dict[str, Any]],
    ocean_analysis_result: Optional[Dict[str, Any]],
    boat_width_m: float = 5.0,
) -> Optional[Dict[str, Any]]:
    """
    Check authoritative hard safety stops first:
    A) SVAS "should not sail"
    B) Active Dangerous Tropical Cyclone
    C) Active Tsunami Warning / Hazard

    Returns override response dict if triggered, or None if clear.
    """
    # -----------------------------------------------------------------------
    # A) SVAS Hard Stop
    # -----------------------------------------------------------------------
    if isinstance(svas_result, dict) and svas_result.get("status") == "success":
        advisory = svas_result.get("advisory") or {}
        msg = str(advisory.get("message") or "").lower()
        severity = str(advisory.get("severity") or "").lower()

        # Check for explicit "should not sail" directive
        should_not_sail_triggers = [
            "should not sail",
            "do not sail",
            "not recommended to sail",
            "operations not recommended",
            "do not venture",
            "stop fishing",
            "unsafe for sailing",
        ]
        is_svas_stop = any(trigger in msg for trigger in should_not_sail_triggers) or (severity == "danger")

        if is_svas_stop:
            factor_item = {
                "id": "advisory",
                "name": "Official INCOIS SVAS Advisory",
                "value": "Sailing Restricted",
                "unit": "advisory",
                "value_formatted": "Restricted (Do Not Sail)",
                "status": "danger",
                "status_label": "Sailing Prohibited",
                "impact": "critical",
                "reason": f"INCOIS SVAS advisory states that vessels of {boat_width_m:.1f}m width should not sail: '{advisory.get('message', 'Unsafe conditions')}'.",
                "interpretation": f"INCOIS SVAS advisory states that vessels of {boat_width_m:.1f}m width should not sail: '{advisory.get('message', 'Unsafe conditions')}'.",
                "is_critical": True,
            }
            vessel_eval_str = f"{boat_width_m:.1f}m Vessel Evaluated" if (boat_width_m and boat_width_m > 0) else None
            explanation_card = {
                "decision": "DONT_GO",
                "decision_label": "DON'T GO - Hazardous Marine Conditions",
                "decision_subtitle": "Official INCOIS sailing restriction in effect",
                "risk_score": 100,
                "status": "NOT_RECOMMENDED",
                "dominant_hazard": "INCOIS Vessel Sailing Restriction",
                "factors": [factor_item],
                "action_guidance": {
                    "headline": "What Should You Do?",
                    "action_text": "🚨 Official INCOIS SVAS advisory restricts sailing for this vessel size. Do not venture out; remain safely in harbor.",
                    "urgency": "critical",
                },
                "vessel_evaluated": vessel_eval_str,
                "boat_width_m": boat_width_m,
                "data_quality": "good",
                "missing_factors": [],
            }
            return {
                "agent": "risk",
                "status": "NOT_RECOMMENDED",
                "risk_score": 100,
                "reasons": [
                    f"INCOIS SVAS advisory states that boats in this size category should not sail: '{advisory.get('message')}'."
                ],
                "factors": [factor_item],
                "missing_factors": [],
                "data_quality": "good",
                "hard_override": True,
                "override_reason": "SVAS_SHOULD_NOT_SAIL",
                "explanation_card": explanation_card,
            }

    # -----------------------------------------------------------------------
    # B) Cyclone Hard Stop
    # -----------------------------------------------------------------------
    if isinstance(ocean_analysis_result, dict):
        cyclone_sec = ocean_analysis_result.get("cyclone") or {}
        has_cyclone = bool(cyclone_sec.get("available") and cyclone_sec.get("data") and cyclone_sec.get("data", {}).get("active_cyclones"))
        cyclone_msg = "Active tropical cyclone warning affects the requested maritime region."

        if not has_cyclone:
            warnings = ocean_analysis_result.get("warnings") or []
            for w in warnings:
                w_type = str(w.get("type", "")).lower()
                if "cyclone" in w_type:
                    has_cyclone = True
                    cyclone_msg = f"Official tropical cyclone warning in effect: {w.get('message', 'Active system')}."
                    break

        if has_cyclone:
            factor_item = {
                "id": "hazards",
                "name": "Tropical Cyclone Warning",
                "value": "Active Cyclone",
                "unit": "warning",
                "value_formatted": "Active Cyclone Alert",
                "status": "danger",
                "status_label": "Extreme Hazard",
                "impact": "critical",
                "reason": cyclone_msg,
                "interpretation": cyclone_msg,
                "is_critical": True,
            }
            vessel_eval_str = f"{boat_width_m:.1f}m Vessel Evaluated" if (boat_width_m and boat_width_m > 0) else None
            explanation_card = {
                "decision": "DONT_GO",
                "decision_label": "DON'T GO - Hazardous Marine Conditions",
                "decision_subtitle": "Active tropical cyclone warning in effect",
                "risk_score": 100,
                "status": "NOT_RECOMMENDED",
                "dominant_hazard": "Tropical Cyclone Warning",
                "factors": [factor_item],
                "action_guidance": {
                    "headline": "What Should You Do?",
                    "action_text": "🚨 Active tropical cyclone alert. All maritime operations must be suspended immediately. Secure vessels and heed Coast Guard directives.",
                    "urgency": "critical",
                },
                "vessel_evaluated": vessel_eval_str,
                "boat_width_m": boat_width_m,
                "data_quality": "good",
                "missing_factors": [],
            }
            return {
                "agent": "risk",
                "status": "NOT_RECOMMENDED",
                "risk_score": 100,
                "reasons": [cyclone_msg],
                "factors": [factor_item],
                "missing_factors": [],
                "data_quality": "good",
                "hard_override": True,
                "override_reason": "ACTIVE_CYCLONE_WARNING",
                "explanation_card": explanation_card,
            }

    # -----------------------------------------------------------------------
    # C) Tsunami Hard Stop
    # -----------------------------------------------------------------------
    if isinstance(ocean_analysis_result, dict):
        tsunami_sec = ocean_analysis_result.get("tsunami") or {}
        has_tsunami = False
        tsunami_msg = "Active seismic / tsunami hazard detected."

        if tsunami_sec.get("available"):
            events = tsunami_sec.get("events") or []
            for ev in events:
                eval_str = str(ev.get("evaluation") or "").lower()
                is_threat = any(k in eval_str for k in ["warning", "alert", "threat", "watch", "evacuation"]) and ("no tsunami threat" not in eval_str)
                if is_threat:
                    has_tsunami = True
                    tsunami_msg = f"INCOIS Tsunami Warning: Bulletin #{ev.get('bulletin_number')} for {ev.get('region', 'nearby region')} ({ev.get('evaluation')})."
                    break

        if not has_tsunami:
            warnings = ocean_analysis_result.get("warnings") or []
            for w in warnings:
                w_type = str(w.get("type", "")).lower()
                w_sev = str(w.get("severity", "")).lower()
                if "tsunami" in w_type and w_sev in ["critical", "high"]:
                    has_tsunami = True
                    tsunami_msg = f"Active seismic / tsunami hazard: {w.get('message')}."
                    break

        if has_tsunami:
            factor_item = {
                "id": "hazards",
                "name": "Tsunami / Seismic Alert",
                "value": "Active Tsunami Warning",
                "unit": "warning",
                "value_formatted": "Active Tsunami Warning",
                "status": "danger",
                "status_label": "Severe Hazard",
                "impact": "critical",
                "reason": tsunami_msg,
                "interpretation": tsunami_msg,
                "is_critical": True,
            }
            vessel_eval_str = f"{boat_width_m:.1f}m Vessel Evaluated" if (boat_width_m and boat_width_m > 0) else None
            explanation_card = {
                "decision": "DONT_GO",
                "decision_label": "DON'T GO - Hazardous Marine Conditions",
                "decision_subtitle": "Active tsunami warning in effect",
                "risk_score": 100,
                "status": "NOT_RECOMMENDED",
                "dominant_hazard": "Tsunami / Seismic Alert",
                "factors": [factor_item],
                "action_guidance": {
                    "headline": "What Should You Do?",
                    "action_text": "🚨 Tsunami warning active. Evacuate coastal waters and move inland or to designated high ground immediately.",
                    "urgency": "critical",
                },
                "vessel_evaluated": vessel_eval_str,
                "boat_width_m": boat_width_m,
                "data_quality": "good",
                "missing_factors": [],
            }
            return {
                "agent": "risk",
                "status": "NOT_RECOMMENDED",
                "risk_score": 100,
                "reasons": [tsunami_msg],
                "factors": [factor_item],
                "missing_factors": [],
                "data_quality": "good",
                "hard_override": True,
                "override_reason": "ACTIVE_TSUNAMI_WARNING",
                "explanation_card": explanation_card,
            }

    return None


# ---------------------------------------------------------------------------
# Data Quality Assessment
# ---------------------------------------------------------------------------

def assess_data_quality(
    available_factor_names: List[str],
    has_marine_weather: bool,
    has_svas: bool,
) -> str:
    """
    Determine overall data quality based on available evidence:
    - "good": All primary environmental factors available.
    - "partial": Some factors missing, but core wave and wind data available.
    - "insufficient": Critical primary factors missing (e.g. neither wave nor wind).
    """
    primary_factors = {"wave_height", "wind_speed", "wind_gusts"}
    available_set = set(available_factor_names)

    if not has_marine_weather or len(available_set.intersection(primary_factors)) < 2:
        return "insufficient"

    if len(available_factor_names) >= 5 and has_svas:
        return "good"

    return "partial"


# ---------------------------------------------------------------------------
# Public Entry Point: calculate_risk
# ---------------------------------------------------------------------------

def calculate_risk(
    latitude: float,
    longitude: float,
    date: str,
    boat_width_m: float,
    pfz_result: Optional[Dict[str, Any]] = None,
    marine_weather_result: Optional[Dict[str, Any]] = None,
    svas_result: Optional[Dict[str, Any]] = None,
    ocean_analysis_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calculate deterministic ORCA safety risk assessment from upstream specialist outputs.

    Parameters:
        latitude: Vessel latitude
        longitude: Vessel longitude
        date: Requested date (YYYY-MM-DD)
        boat_width_m: Vessel width in meters
        pfz_result: Output from Agent #1 (PFZ) - contextual only
        marine_weather_result: Output from Agent #2 (Marine Weather)
        svas_result: Output from Agent #3 (SVAS)
        ocean_analysis_result: Output from Agent #4 (Ocean Analysis)

    Returns:
        Structured, explainable JSON-serializable dictionary with 0-100 risk score,
        status band, contributing factors, weight renormalizations, and reasons.
    """
    # -----------------------------------------------------------------------
    # Source Status Mapping
    # -----------------------------------------------------------------------
    source_status = {
        "pfz": pfz_result.get("status", "unavailable") if isinstance(pfz_result, dict) else "unavailable",
        "marine_weather": marine_weather_result.get("status", "unavailable") if isinstance(marine_weather_result, dict) else "unavailable",
        "svas": svas_result.get("status", "unavailable") if isinstance(svas_result, dict) else "unavailable",
        "ocean_analysis": ocean_analysis_result.get("status", "unavailable") if isinstance(ocean_analysis_result, dict) else "unavailable",
    }

    # -----------------------------------------------------------------------
    # STEP 1: Hard Safety Overrides
    # -----------------------------------------------------------------------
    hard_override_resp = evaluate_hard_safety_overrides(svas_result, ocean_analysis_result, boat_width_m=boat_width_m)
    if hard_override_resp is not None:
        hard_override_resp["source_status"] = source_status
        return hard_override_resp

    # -----------------------------------------------------------------------
    # STEP 2: Extract Environmental Values (Only if date_match is True)
    # -----------------------------------------------------------------------
    weather_date_valid = (
        isinstance(marine_weather_result, dict)
        and marine_weather_result.get("status") == "success"
        and marine_weather_result.get("date_match", True) is not False
    )

    marine_data = {}
    weather_data = {}
    if weather_date_valid:
        raw_marine = marine_weather_result.get("marine")
        if isinstance(raw_marine, dict):
            marine_data = raw_marine
        raw_weather = marine_weather_result.get("weather")
        if isinstance(raw_weather, dict):
            weather_data = raw_weather

    wave_val = marine_data.get("wave_height_m")
    if wave_val is None:
        wave_val = marine_data.get("wave_height")

    wind_val = weather_data.get("wind_speed_knots")
    if wind_val is None:
        wind_val = weather_data.get("wind_speed_10m")

    gust_val = weather_data.get("wind_gusts_knots")
    if gust_val is None:
        gust_val = weather_data.get("wind_gusts_10m")

    curr_val = marine_data.get("ocean_current_velocity_kmh")
    if curr_val is None:
        curr_val = marine_data.get("ocean_current_velocity")

    # Evaluate individual components
    wave_risk, wave_reason = calculate_wave_risk(wave_val)
    wind_risk, wind_reason = calculate_wind_risk(wind_val)
    gust_risk, gust_reason = calculate_gust_risk(gust_val)
    current_risk, current_reason = calculate_current_risk(curr_val)
    lightning_risk, lightning_reason = calculate_lightning_risk(ocean_analysis_result, marine_weather_result)
    other_ocean_risk, other_ocean_reason = calculate_other_ocean_risk(ocean_analysis_result)

    # -----------------------------------------------------------------------
    # Collect Available Factors & Dynamic Weight Renormalization
    # -----------------------------------------------------------------------
    candidate_factors = [
        {
            "factor": "wave_height",
            "value": wave_val,
            "unit": "m",
            "risk": wave_risk,
            "reason": wave_reason,
            "base_weight": BASE_WEIGHTS["wave_height"],
        },
        {
            "factor": "wind_speed",
            "value": wind_val,
            "unit": "kt",
            "risk": wind_risk,
            "reason": wind_reason,
            "base_weight": BASE_WEIGHTS["wind_speed"],
        },
        {
            "factor": "wind_gusts",
            "value": gust_val,
            "unit": "kt",
            "risk": gust_risk,
            "reason": gust_reason,
            "base_weight": BASE_WEIGHTS["wind_gusts"],
        },
        {
            "factor": "ocean_current",
            "value": curr_val,
            "unit": "km/h",
            "risk": current_risk,
            "reason": current_reason,
            "base_weight": BASE_WEIGHTS["ocean_current"],
        },
        {
            "factor": "lightning_convective",
            "value": "active" if lightning_risk == 100 else ("elevated" if lightning_risk == 50 else "clear") if lightning_risk is not None else None,
            "unit": "index",
            "risk": lightning_risk,
            "reason": lightning_reason,
            "base_weight": BASE_WEIGHTS["lightning_convective"],
        },
        {
            "factor": "other_ocean_hazard",
            "value": "active" if other_ocean_risk == 100 else ("elevated" if other_ocean_risk == 50 else "none") if other_ocean_risk is not None else None,
            "unit": "warning_level",
            "risk": other_ocean_risk,
            "reason": other_ocean_reason,
            "base_weight": BASE_WEIGHTS["other_ocean_hazard"],
        },
    ]

    available_factors = []
    missing_factors = []

    for item in candidate_factors:
        if item["risk"] is not None:
            available_factors.append(item)
        else:
            missing_factors.append(item["factor"])

    # If critical information is missing
    has_marine = isinstance(marine_weather_result, dict) and marine_weather_result.get("status") == "success"
    has_svas = isinstance(svas_result, dict) and svas_result.get("status") == "success"
    available_names = [f["factor"] for f in available_factors]
    data_quality = assess_data_quality(available_names, has_marine, has_svas)

    # -----------------------------------------------------------------------
    # Renormalize Weights & Calculate Final Weighted Score
    # -----------------------------------------------------------------------
    reasons: List[str] = []
    factor_breakdown: List[Dict[str, Any]] = []

    if not available_factors:
        # Edge case: No data available whatsoever
        explanation_card = {
            "decision": "DONT_GO",
            "decision_label": "INSUFFICIENT DATA",
            "decision_subtitle": "Critical marine data unavailable",
            "risk_score": 100,
            "status": "NOT_RECOMMENDED",
            "dominant_hazard": "Missing Environmental Observations",
            "factors": [
                {
                    "id": m,
                    "name": m.replace("_", " ").title(),
                    "value": None,
                    "unit": "",
                    "value_formatted": "N/A",
                    "status": "unavailable",
                    "status_label": "Data Unavailable",
                    "impact": "unknown",
                    "reason": "Missing data is not safe data. Live observations were not reported by data feeds.",
                    "is_critical": False,
                }
                for m in missing_factors
            ],
            "action_guidance": {
                "headline": "What Should You Do?",
                "action_text": "Critical marine observations are missing. Do not venture into open sea without local visual confirmation and official port clearance.",
                "urgency": "immediate",
            },
            "vessel_evaluated": bool(boat_width_m and boat_width_m > 0),
            "boat_width_m": boat_width_m,
            "data_quality": "insufficient",
            "missing_factors": [m.replace("_", " ").title() for m in missing_factors],
        }
        return {
            "agent": "risk",
            "status": "NOT_RECOMMENDED",
            "risk_score": 100,
            "reasons": ["Insufficient environmental and marine data available to confirm safe trip conditions."],
            "factors": [],
            "missing_factors": missing_factors,
            "data_quality": "insufficient",
            "hard_override": False,
            "override_reason": None,
            "source_status": source_status,
            "explanation_card": explanation_card,
        }

    sum_available_base_weights = sum(item["base_weight"] for item in available_factors)
    total_weighted_risk = 0.0

    for item in available_factors:
        effective_weight = item["base_weight"] / sum_available_base_weights
        contribution = round(effective_weight * float(item["risk"]), 2)
        total_weighted_risk += effective_weight * float(item["risk"])

        if item["reason"]:
            reasons.append(item["reason"])

        factor_breakdown.append({
            "factor": item["factor"],
            "value": item["value"],
            "unit": item["unit"],
            "risk": item["risk"],
            "weight": round(effective_weight, 4),
            "base_weight": item["base_weight"],
            "contribution": contribution,
        })

    final_risk_score = int(round(total_weighted_risk))
    final_risk_score = max(0, min(100, final_risk_score))
    status = classify_status(final_risk_score)

    if data_quality == "insufficient":
        reasons.append("Caution: Critical marine weather factors were missing, increasing uncertainty.")

    # -----------------------------------------------------------------------
    # STEP 3: Construct Visual "WHY?" Risk Explanation Card
    # -----------------------------------------------------------------------
    explainable_factors: List[Dict[str, Any]] = []

    # 1. Wave Factor
    if wave_val is not None:
        w_status = "safe" if wave_risk == 0 else ("caution" if wave_risk == 35 else "danger")
        w_impact = "low" if wave_risk == 0 else ("moderate" if wave_risk == 35 else ("high" if wave_risk == 70 else "critical"))
        w_label = "Low Impact (Calm Sea)" if wave_risk == 0 else ("Moderate Waves" if wave_risk == 35 else "Severe Wave Hazard")
        w_boat_note = f" Within safe operating limits for your {boat_width_m:.1f}m vessel." if wave_risk == 0 else (f" Requires extra caution on a {boat_width_m:.1f}m boat." if wave_risk == 35 else f" High risk of swamping for a {boat_width_m:.1f}m boat.")
        explainable_factors.append({
            "id": "waves",
            "name": "Wave Height",
            "value": wave_val,
            "unit": "m",
            "value_formatted": f"{wave_val:.1f} m",
            "status": w_status,
            "status_label": w_label,
            "impact": w_impact,
            "reason": f"Wave height is {wave_val:.1f} m.{w_boat_note}",
            "is_critical": bool(wave_risk is not None and wave_risk >= 70),
        })
    else:
        explainable_factors.append({
            "id": "waves",
            "name": "Wave Height",
            "value": None,
            "unit": "m",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Wave height observations are currently unavailable from data feeds.",
            "is_critical": False,
        })

    # 2. Wind Factor
    if wind_val is not None:
        wd_status = "safe" if wind_risk == 0 else ("caution" if wind_risk == 30 else "danger")
        wd_impact = "low" if wind_risk == 0 else ("moderate" if wind_risk == 30 else ("high" if wind_risk == 70 else "critical"))
        wd_label = "Light Breeze" if wind_risk == 0 else ("Moderate Wind" if wind_risk == 30 else ("Strong Wind" if wind_risk == 70 else "Gale Force Wind"))
        explainable_factors.append({
            "id": "wind",
            "name": "Wind Speed",
            "value": wind_val,
            "unit": "kt",
            "value_formatted": f"{wind_val:.1f} kt",
            "status": wd_status,
            "status_label": wd_label,
            "impact": wd_impact,
            "reason": f"Sustained wind speed is {wind_val:.1f} knots ({wd_label.lower()}).",
            "is_critical": bool(wind_risk is not None and wind_risk >= 70),
        })
    else:
        explainable_factors.append({
            "id": "wind",
            "name": "Wind Speed",
            "value": None,
            "unit": "kt",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Wind speed observations are currently unavailable.",
            "is_critical": False,
        })

    # 3. Wind Gusts Factor
    if gust_val is not None:
        g_status = "safe" if gust_risk == 0 else ("caution" if gust_risk == 30 else "danger")
        g_impact = "low" if gust_risk == 0 else ("moderate" if gust_risk == 30 else ("high" if gust_risk == 70 else "critical"))
        g_label = "Low Gustiness" if gust_risk == 0 else ("Moderate Gusts" if gust_risk == 30 else "Dangerous Squalls")
        explainable_factors.append({
            "id": "gusts",
            "name": "Wind Gusts",
            "value": gust_val,
            "unit": "kt",
            "value_formatted": f"{gust_val:.1f} kt",
            "status": g_status,
            "status_label": g_label,
            "impact": g_impact,
            "reason": f"Peak gusts reaching {gust_val:.1f} knots ({g_label.lower()}).",
            "is_critical": bool(gust_risk is not None and gust_risk >= 70),
        })
    else:
        explainable_factors.append({
            "id": "gusts",
            "name": "Wind Gusts",
            "value": None,
            "unit": "kt",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Wind gust data is currently unavailable.",
            "is_critical": False,
        })

    # 4. Ocean Current Factor
    if curr_val is not None:
        c_status = "safe" if current_risk == 0 else ("caution" if current_risk == 30 else "danger")
        c_impact = "low" if current_risk == 0 else ("moderate" if current_risk == 30 else ("high" if current_risk == 70 else "critical"))
        c_label = "Mild Current" if current_risk == 0 else ("Moderate Drift" if current_risk == 30 else "Strong Current")
        explainable_factors.append({
            "id": "current",
            "name": "Ocean Current",
            "value": curr_val,
            "unit": "km/h",
            "value_formatted": f"{curr_val:.1f} km/h",
            "status": c_status,
            "status_label": c_label,
            "impact": c_impact,
            "reason": f"Current velocity is {curr_val:.1f} km/h ({c_label.lower()}).",
            "is_critical": bool(current_risk is not None and current_risk >= 70),
        })
    else:
        explainable_factors.append({
            "id": "current",
            "name": "Ocean Current",
            "value": None,
            "unit": "km/h",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Ocean current data is currently unavailable.",
            "is_critical": False,
        })

    # 5. Thunderstorm / Lightning Factor
    if lightning_risk is not None:
        l_status = "danger" if lightning_risk == 100 else ("caution" if lightning_risk == 50 else "safe")
        l_impact = "critical" if lightning_risk == 100 else ("moderate" if lightning_risk == 50 else "low")
        l_label = "Active Lightning Hazard" if lightning_risk == 100 else ("Elevated Storm Risk" if lightning_risk == 50 else "Clear (No Storms)")
        explainable_factors.append({
            "id": "lightning",
            "name": "Thunderstorm & Lightning",
            "value": "active" if lightning_risk == 100 else ("elevated" if lightning_risk == 50 else "clear"),
            "unit": "status",
            "value_formatted": l_label,
            "status": l_status,
            "status_label": l_label,
            "impact": l_impact,
            "reason": lightning_reason or ("No convective lightning activity detected." if lightning_risk == 0 else "Atmospheric instability detected."),
            "is_critical": bool(lightning_risk == 100),
        })
    else:
        explainable_factors.append({
            "id": "lightning",
            "name": "Thunderstorm & Lightning",
            "value": None,
            "unit": "status",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Convective storm radar data is currently unavailable.",
            "is_critical": False,
        })

    # 6. Official SVAS Advisory Factor
    if isinstance(svas_result, dict) and svas_result.get("status") == "success":
        adv = svas_result.get("advisory", {})
        adv_sev = str(adv.get("severity", "")).lower()
        adv_msg = str(adv.get("message", "")).strip()
        is_adv_caution = adv_sev in ["warning", "alert", "caution", "advisory"]
        explainable_factors.append({
            "id": "advisory",
            "name": "Official INCOIS SVAS Advisory",
            "value": adv_sev or "safe",
            "unit": "advisory",
            "value_formatted": f"Active ({adv_sev.upper()})" if is_adv_caution else "No Sailing Restrictions",
            "status": "caution" if is_adv_caution else "safe",
            "status_label": "Advisory in Effect" if is_adv_caution else "Clear",
            "impact": "moderate" if is_adv_caution else "low",
            "reason": adv_msg or "INCOIS SVAS service permits sailing for this vessel category.",
            "is_critical": False,
        })
    elif isinstance(svas_result, dict) and svas_result.get("reason"):
        explainable_factors.append({
            "id": "advisory",
            "name": "Official INCOIS SVAS Advisory",
            "value": "Info",
            "unit": "advisory",
            "value_formatted": "Vessel Category Notice",
            "status": "safe",
            "status_label": "Standard Rules",
            "impact": "low",
            "reason": str(svas_result.get("reason")),
            "is_critical": False,
        })
    else:
        explainable_factors.append({
            "id": "advisory",
            "name": "Official INCOIS SVAS Advisory",
            "value": None,
            "unit": "advisory",
            "value_formatted": "Data unavailable",
            "status": "unavailable",
            "status_label": "Data Unavailable",
            "impact": "unknown",
            "reason": "Official INCOIS SVAS bulletin is currently unavailable.",
            "is_critical": False,
        })

    for f in explainable_factors:
        if "interpretation" not in f:
            f["interpretation"] = f.get("reason", "")

    # Sort factors by severity: Danger/Critical first, Caution second, Safe third, Unavailable last
    def factor_sort_key(f: Dict[str, Any]) -> int:
        st = f.get("status")
        if st == "danger" or f.get("is_critical"):
            return 0
        if st == "caution":
            return 1
        if st == "safe":
            return 2
        return 3

    sorted_factors = sorted(explainable_factors, key=factor_sort_key)

    danger_factors = [f for f in sorted_factors if f.get("status") == "danger"]
    caution_factors = [f for f in sorted_factors if f.get("status") == "caution"]

    # Determine Big Decision, Dominant Hazard, Primary Watch Item, and Action Guidance
    primary_thing_to_watch = None
    primary_thing_to_watch_reason = None

    if status in ["NOT_RECOMMENDED", "HIGH_RISK"] or final_risk_score >= 60 or (danger_factors and any(f.get("is_critical") for f in danger_factors)):
        decision = "DONT_GO"
        decision_label = "DON'T GO - Hazardous Marine Conditions"
        decision_subtitle = f"Unsafe {danger_factors[0]['name'].lower()} detected" if danger_factors else "Unsafe or high-risk conditions detected"
        urgency = "critical"
        dominant_hazard = danger_factors[0].get("name") if danger_factors else "Cumulative Elevated Marine Risk"
        action_text = f"🚨 {dominant_hazard} poses an immediate safety hazard. Delay departure and remain ashore or in sheltered harbor until conditions clear."
    elif status == "CAUTION" or (30 <= final_risk_score < 60) or (len(caution_factors) >= 2 and final_risk_score >= 25):
        decision = "CAUTION"
        decision_label = "CAUTION - Marginal Marine Conditions"
        dominant_hazard = (danger_factors[0] if danger_factors else caution_factors[0]).get("name") if (danger_factors or caution_factors) else None
        decision_subtitle = f"Caution required due to {dominant_hazard.lower()}" if dominant_hazard else "Conditions require extra care"
        urgency = "moderate"
        action_text = f"Proceed with caution. Monitor changing {dominant_hazard.lower() if dominant_hazard else 'marine'} conditions and avoid offshore exposure."
    else:
        decision = "GO"
        decision_label = "GO - Safe Marine Conditions"
        decision_subtitle = "Conditions generally favourable for sailing"
        urgency = "routine"
        dominant_hazard = None
        if caution_factors:
            primary_thing_to_watch = caution_factors[0].get("name")
            primary_thing_to_watch_reason = caution_factors[0].get("reason") or caution_factors[0].get("interpretation")
        action_text = "Conditions are generally favourable for departure. Maintain standard navigation safety watch and continue monitoring routine weather updates."

    missing_names = [
        {"wave_height": "Wave Height", "wind_speed": "Wind Speed", "wind_gusts": "Wind Gusts", "ocean_current": "Ocean Current", "lightning_convective": "Thunderstorm & Lightning", "other_ocean_hazard": "Marine Hazards"}.get(m, m.replace("_", " ").title())
        for m in missing_factors
    ]

    vessel_eval_str = f"{boat_width_m:.1f}m Vessel Evaluated" if (boat_width_m and boat_width_m > 0) else None

    explanation_card = {
        "decision": decision,
        "decision_label": decision_label,
        "decision_subtitle": decision_subtitle,
        "risk_score": final_risk_score,
        "status": status,
        "dominant_hazard": dominant_hazard,
        "primary_thing_to_watch": primary_thing_to_watch,
        "primary_thing_to_watch_reason": primary_thing_to_watch_reason,
        "factors": sorted_factors,
        "action_guidance": {
            "headline": "What Should You Do?",
            "action_text": action_text,
            "urgency": urgency,
        },
        "vessel_evaluated": vessel_eval_str,
        "boat_width_m": boat_width_m,
        "data_quality": data_quality,
        "missing_factors": missing_names,
    }

    return {
        "agent": "risk",
        "status": status,
        "risk_score": final_risk_score,
        "reasons": reasons,
        "factors": factor_breakdown,
        "missing_factors": missing_factors,
        "data_quality": data_quality,
        "hard_override": False,
        "override_reason": None,
        "source_status": source_status,
        "explanation_card": explanation_card,
    }


# ---------------------------------------------------------------------------
# CLI Test Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    # Example test run with mock inputs
    test_mw = {
        "status": "success",
        "weather": {"wind_speed_knots": 18.0, "wind_gusts_knots": 27.0},
        "marine": {"wave_height_m": 2.1, "ocean_current_velocity_kmh": 1.5},
    }
    test_oa = {
        "status": "partial",
        "lightning": {
            "available": True,
            "data": {"elevated_convective_risk": True, "thunderstorm_active": False},
        },
        "warnings": [],
    }
    test_svas = {
        "status": "success",
        "advisory": {"severity": "caution", "message": "Normal precautions"},
    }

    res = calculate_risk(
        latitude=18.95,
        longitude=72.80,
        date="2026-09-04",
        boat_width_m=2.5,
        marine_weather_result=test_mw,
        ocean_analysis_result=test_oa,
        svas_result=test_svas,
    )
    print("Risk Agent Calculation Result:")
    print(json.dumps(res, indent=2))
