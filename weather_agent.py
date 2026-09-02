from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

from agents.marine_weather.main import fetch_marine_weather
from agents.pfz.main import find_nearest_pfz


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(override=True)


# ============================================================
# GEMINI
# ============================================================

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    max_retries=2,
    timeout=60,
)


# ============================================================
# MARINE WEATHER TOOL
# ============================================================

@tool
def get_weather_marine(
    latitude: float,
    longitude: float,
) -> Any:
    """
    Fetch current atmospheric weather and marine/ocean
    conditions for the specified coordinates.
    """

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
# PFZ TOOL
# ============================================================

@tool
def get_nearest_pfz(
    latitude: float,
    longitude: float,
) -> Any:
    """
    Find the nearest live Potential Fishing Zone (PFZ)
    for the specified coordinates using INCOIS data.
    """

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


# ============================================================
# COMBINED MARINE INTELLIGENCE AGENT
# ============================================================

marine_intelligence_agent = create_agent(
    model=llm,
    tools=[
        get_weather_marine,
        get_nearest_pfz,
    ],
    system_prompt="""
You are the Marine Intelligence Agent of ORCA.

You have access to two live tools:

1. get_weather_marine
   - Current atmospheric weather
   - Wind speed
   - Wind gusts
   - Wave height
   - Wave period
   - Sea surface temperature
   - Ocean current

2. get_nearest_pfz
   - Live INCOIS Potential Fishing Zone
   - Nearest PFZ location
   - Distance from fisherman
   - Bearing and direction
   - PFZ freshness information

RULES:

When latitude and longitude are provided:

- Use the PFZ tool when the user asks about
  fishing zones, fishing locations, or where to fish.
- Use the marine weather tool when the user asks
  about marine/weather conditions or fishing safety.
- Use BOTH tools when the question involves both
  fishing location and marine conditions.

Always use live tool data.

Do not invent values.

Do not treat PFZ as a safety warning.
PFZ indicates a potential fishing zone.

Do not claim that your weather assessment is an
official maritime safety classification unless an
explicit safety rule is provided.

When both tools are used, clearly separate:

PFZ INFORMATION
and
MARINE WEATHER INFORMATION

Then provide a concise overall interpretation
based only on the returned data.
""",
)


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 70)
    print("ORCA MARINE INTELLIGENCE AGENT")
    print("=" * 70)

    print("\n[AGENT] Sending request to Gemini...")

    try:

        result = marine_intelligence_agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "what is capital of maharashtra"
                        ),
                    }
                ]
            }
        )

        print("\n[AGENT] Response received.")

        print("\nRESULT:")

        # Print ONLY the final Gemini response.
        # Avoid dumping the complete LangChain state and
        # Gemini function-call signatures.

        for message in reversed(result["messages"]):

            if getattr(message, "type", None) != "ai":
                continue

            if not message.content:
                continue

            if isinstance(message.content, list):

                printed = False

                for item in message.content:

                    if (
                        isinstance(item, dict)
                        and item.get("type") == "text"
                    ):
                        print(item["text"])
                        printed = True
                        break

                if printed:
                    break

            else:
                print(message.content)
                break

    except Exception as exc:

        print("\n[ERROR]")
        print(type(exc).__name__)
        print(exc)