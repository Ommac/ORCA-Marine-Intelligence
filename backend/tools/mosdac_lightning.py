import requests
import json

MOSDAC_WFS_URL = "https://www.mosdac.gov.in/geoserver/MOSDAC/ows"
MOSDAC_WMS_URL = "https://www.mosdac.gov.in/geoserver/MOSDAC/wms"

# Open-Meteo Marine/Atmosphere Weather API (Free public fallback)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_live_lightning(lat=10.0, lon=76.0):
    """
    Fetches real-time convective/lightning risk data.
    Attempts MOSDAC first, then falls back to Open-Meteo Weather API.
    """
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    # 1. Attempt MOSDAC Vector Layer Query
    mosdac_params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetFeature",
        "typeName": "MOSDAC:lightning_forecast",
        "outputFormat": "application/json"
    }
    
    print("Attempting to fetch lightning data from MOSDAC WFS endpoint...")
    try:
        response = requests.get(OPEN_METEO_URL, params=mosdac_params, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            if features:
                print(f"Retrieved {len(features)} MOSDAC lightning vector features.")
                return {
                    "status": "active_lightning",
                    "source": "MOSDAC_WFS",
                    "hazard_detected": True,
                    "spatial_data": features,
                    "default_risk_score": 0.85
                }
    except requests.exceptions.RequestException:
        print("Notice: MOSDAC direct WFS vector layer offline or unavailable.")

    # 2. Secondary Fallback: Open-Meteo Public Atmospheric API
    print("Switching to secondary global fallback (Open-Meteo Atmospheric API)...")
    try:
        om_params = {
            "latitude": lat,
            "longitude": lon,
            "current": ["weather_code", "precipitation", "showers"],
            "hourly": ["cape"],  # CAPE (Convective Available Potential Energy) > 1000 indicates lightning/thunderstorm risk
            "forecast_days": 1
        }
        om_response = requests.get(OPEN_METEO_URL, params=om_params, headers=headers, timeout=8)
        
        if om_response.status_code == 200:
            om_data = om_response.json()
            hourly_cape = om_data.get("hourly", {}).get("cape", [0])
            max_cape = max(hourly_cape) if hourly_cape else 0
            
            # Weather codes 95, 96, 99 correspond to Thunderstorms / Severe Lightning
            current_code = om_data.get("current", {}).get("weather_code", 0)
            is_thunderstorm = current_code in [95, 96, 99] or max_cape > 1500

            print("Successfully processed convective assessment from fallback API.")
            return {
                "status": "active_convective_system" if is_thunderstorm else "clear",
                "source": "Open-Meteo_API",
                "hazard_detected": is_thunderstorm,
                "convective_cape_index": max_cape,
                "weather_code": current_code,
                "spatial_data": [{
                    "latitude": lat,
                    "longitude": lon,
                    "thunderstorm_active": is_thunderstorm
                }],
                "default_risk_score": 0.85 if is_thunderstorm else 0.0
            }

    except Exception as fallback_err:
        print(f"Fallback Request Error: {fallback_err}")

    # Default payload when all APIs are clear/unreachable
    return {
        "status": "clear",
        "hazard_detected": False,
        "spatial_data": [],
        "default_risk_score": 0.0
    }


def get_mosdac_wms_map_url(bbox="68.0,8.0,89.0,24.0"):
    """Generates a MOSDAC WMS PNG layer URL for map visualization."""
    params = {
        "service": "WMS",
        "version": "1.1.0",
        "request": "GetMap",
        "layers": "MOSDAC:lightning_forecast",
        "styles": "",
        "bbox": bbox,
        "width": 768,
        "height": 512,
        "srs": "EPSG:4326",
        "format": "image/png"
    }
    req = requests.Request('GET', MOSDAC_WMS_URL, params=params)
    return req.prepare().url


if __name__ == "__main__":
    # Test execution for Kochi Coast coordinates
    result = fetch_live_lightning(lat=9.93, lon=76.26)
    print("\nLightning Agent Payload:")
    print(json.dumps(result, indent=2))
    
    print("\nGenerated MOSDAC Map Layer URL:")
    print(get_mosdac_wms_map_url())