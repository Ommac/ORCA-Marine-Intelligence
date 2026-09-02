import requests

url = "https://www.incois.gov.in/geoserver/ows"

params = {
    "service": "WFS",
    "version": "1.1.0",
    "request": "GetCapabilities",
}

headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/151.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.incois.gov.in/",
    "Origin": "https://www.incois.gov.in",
    "Accept": "*/*",
}

r = requests.get(
    url,
    params=params,
    headers=headers,
    timeout=30
)

print("Status:", r.status_code)
print("URL:", r.url)
print(r.text[:5000])