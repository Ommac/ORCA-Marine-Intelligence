import json
import os

from dotenv import load_dotenv
from google import genai

from agents.pfz.main import find_nearest_pfz
from agents.marine_weather.main import fetch_marine_weather


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(dotenv_path=".env")

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


# ============================================================
# TOOL IMPLEMENTATIONS
# ============================================================

def get_nearest_pfz(
    latitude: float,
    longitude: float,
) -> dict:
    """Get the nearest live INCOIS Potential Fishing Zone."""

    print(
        f"\n[PFZ TOOL] Searching nearest PFZ for "
        f"{latitude}, {longitude}"
    )

    result = find_nearest_pfz(
        latitude=latitude,
        longitude=longitude,
    )

    if result.get("status") == "success":

        distance = (
            result
            .get("pfz", {})
            .get("nearest_point", {})
            .get("distance_km")
        )

        print(
            f"[PFZ TOOL] PFZ found successfully "
            f"({distance} km away)."
        )

    else:
        print("[PFZ TOOL] PFZ lookup failed.")

    return result


def get_weather_marine(
    latitude: float,
    longitude: float,
) -> dict:
    """Get current weather and marine conditions."""

    print(
        f"\n[WEATHER TOOL] Fetching marine weather for "
        f"{latitude}, {longitude}"
    )

    result = fetch_marine_weather(
        latitude=latitude,
        longitude=longitude,
    )

    print("[WEATHER TOOL] Data received successfully.")

    return result


# ============================================================
# GEMINI TOOL DEFINITIONS
# ============================================================

pfz_tool = {
    "type": "function",
    "name": "get_nearest_pfz",
    "description": (
        "Find the nearest live Potential Fishing Zone "
        "from INCOIS for the given latitude and longitude."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "latitude": {
                "type": "number",
                "description": "Fisherman's latitude."
            },
            "longitude": {
                "type": "number",
                "description": "Fisherman's longitude."
            },
        },
        "required": [
            "latitude",
            "longitude",
        ],
    },
}


weather_tool = {
    "type": "function",
    "name": "get_weather_marine",
    "description": (
        "Fetch current atmospheric weather and marine "
        "conditions for the given latitude and longitude."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "latitude": {
                "type": "number",
                "description": "Fisherman's latitude."
            },
            "longitude": {
                "type": "number",
                "description": "Fisherman's longitude."
            },
        },
        "required": [
            "latitude",
            "longitude",
        ],
    },
}


# ============================================================
# TOOL ROUTER
# ============================================================

def execute_tool(name: str, arguments: dict) -> dict:

    if name == "get_nearest_pfz":
        return get_nearest_pfz(
            latitude=float(arguments["latitude"]),
            longitude=float(arguments["longitude"]),
        )

    if name == "get_weather_marine":
        return get_weather_marine(
            latitude=float(arguments["latitude"]),
            longitude=float(arguments["longitude"]),
        )

    return {
        "status": "error",
        "error": f"Unknown tool: {name}",
    }


# ============================================================
# ORCHESTRATOR
# ============================================================

def run_orca(query: str) -> str:

    print("\n[ORCHESTRATOR] Sending request to Gemini...")

    interaction = client.interactions.create(
        model="gemini-3.6-flash",
        input=query,
        system_instruction="""
You are the ORCA Marine Intelligence Orchestrator.

You coordinate live marine intelligence tools for fishermen.

Available tools:

1. get_nearest_pfz
   Use when the user asks about:
   - Potential Fishing Zones
   - nearest fishing zone
   - where to fish
   - distance/direction to a fishing zone

2. get_weather_marine
   Use when the user asks about:
   - current weather
   - marine conditions
   - wind
   - gusts
   - waves
   - wave period
   - sea surface temperature
   - ocean currents
   - fishing conditions related to marine weather

Use BOTH tools when the user's question requires both
fishing-zone information and marine-weather information.

Never invent values.

Base factual claims on tool results.

Return a concise, fisherman-friendly answer.
""",
        tools=[
            pfz_tool,
            weather_tool,
        ],
    )

    # --------------------------------------------------------
    # Process model steps and execute requested functions
    # --------------------------------------------------------

    function_calls = []

    for step in interaction.steps:

        if step.type == "function_call":

            function_calls.append(step)

    # No tool call: Gemini answered directly.
    if not function_calls:

        return interaction.output_text

    # --------------------------------------------------------
    # Execute all requested tools
    # --------------------------------------------------------

    function_results = []

    for call in function_calls:

        print(
            f"[ORCHESTRATOR] Gemini selected tool: "
            f"{call.name}"
        )

        arguments = call.arguments

        if isinstance(arguments, str):
            arguments = json.loads(arguments)

        result = execute_tool(
            call.name,
            arguments,
        )

        function_results.append(
    {
        "type": "function_result",
        "name": call.name,
        "call_id": call.id,
        "result": [
            {
                "type": "text",
                "text": json.dumps(result),
            }
        ],
    }
)

    # --------------------------------------------------------
    # Send tool results back to Gemini
    # --------------------------------------------------------

    print("\n[ORCHESTRATOR] Sending tool results to Gemini...")

    final_interaction = client.interactions.create(
        model="gemini-3.6-flash",
        previous_interaction_id=interaction.id,
        input=function_results,
        tools=[
            pfz_tool,
            weather_tool,
        ],
        system_instruction="""
Use the returned tool data to answer the fisherman.

Do not invent values.

Clearly distinguish PFZ information from marine-weather
information.

Provide a concise practical interpretation.
""",
    )

    return final_interaction.output_text


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 70)
    print("ORCA MARINE INTELLIGENCE ORCHESTRATOR")
    print("=" * 70)

    test_query = (
        "I am a fisherman at latitude 19.72 and longitude 72.70. "
        "I want to go fishing right now. Find the nearest Potential "
        "Fishing Zone and also check the current marine weather. "
        "Tell me the PFZ distance and direction and explain the "
        "current marine conditions."
    )

    try:

        result = run_orca(test_query)

        print("\n[ORCHESTRATOR] Final response received.")

        print("\nRESULT:")
        print(result)

    except Exception as exc:

        print("\n[ERROR]")
        print(type(exc).__name__)
        print(exc)