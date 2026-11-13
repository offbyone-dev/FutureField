from datetime import date, timedelta

from app.data_sources.nasa_vegetation import NasaVegetationClient
from app.data_sources.base import FILL_VALUE

end = date.today() - timedelta(days=7)
start = end - timedelta(days=90)

# Replace with coordinates from the affected saved field.
lat = 24.0052180707036
lon = 90.4886755576376

print("Testing NASA MODIS NDVI...")
print("Location:", lat, lon)
print("Period:", start, "to", end)

try:
    result = NasaVegetationClient().get_series(
        lat=lat,
        lon=lon,
        start=start,
        end=end,
    )

    dates = result["dates"]
    values = result["ndvi"]

    valid = [
        (day, value)
        for day, value in zip(dates, values)
        if value != FILL_VALUE
    ]

    print("Total days:", len(values))
    print("Valid NDVI days:", len(valid))
    print("Latest valid observations:", valid[-5:])

except Exception as exc:
    print("MODIS ERROR:", type(exc).__name__, str(exc))