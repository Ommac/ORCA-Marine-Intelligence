import requests
import json


MOSDAC_URL = (
    "https://www.mosdac.gov.in/"
    "api/v1/ocean/chlorophyll"
)


def fetch_chlorophyll(
    min_lon=72.0,
    min_lat=8.0,
    max_lon=78.0,
    max_lat=15.0,
    date="2026-09-02"
):

    params = {
        "bbox": (
            f"{min_lon},"
            f"{min_lat},"
            f"{max_lon},"
            f"{max_lat}"
        ),
        "date": date
    }

    headers = {
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/151.0 Safari/537.36"
        ),
        "Accept": "application/json"
    }

    print("=" * 70)
    print("MOSDAC CHLOROPHYLL-A")
    print("=" * 70)

    print("\nRequesting:")
    print(MOSDAC_URL)

    print("\nParameters:")
    print(params)

    try:

        response = requests.get(
            MOSDAC_URL,
            params=params,
            headers=headers,
            timeout=60
        )

        print("\nHTTP Status:")
        print(response.status_code)

        print("\nFinal URL:")
        print(response.url)

        print("\nContent-Type:")
        print(
            response.headers.get(
                "Content-Type"
            )
        )

        response.raise_for_status()

    except requests.exceptions.HTTPError as e:

        print("\nHTTP ERROR:")
        print(e)

        print("\nServer response:")
        print(response.text[:5000])

        return None

    except requests.exceptions.RequestException as e:

        print("\nREQUEST ERROR:")
        print(e)

        return None

    try:

        data = response.json()

    except ValueError:

        print("\nResponse is not JSON.")

        print(response.text[:5000])

        return None

    print("\nJSON RESPONSE:")

    print(
        json.dumps(
            data,
            indent=2,
            default=str
        )[:10000]
    )

    return data


if __name__ == "__main__":

    data = fetch_chlorophyll(
        min_lon=72.0,
        min_lat=8.0,
        max_lon=78.0,
        max_lat=15.0,
        date="2026-09-02"
    )

    if data is not None:

        print("\n✓ MOSDAC request successful")

    else:

        print("\n✗ No Chlorophyll data returned")