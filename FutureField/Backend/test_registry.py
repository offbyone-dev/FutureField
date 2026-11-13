from datetime import date, timedelta

from app.data_sources import registry
from app.data_sources.base import FILL_VALUE

lat = 24.0052180707036
lon = 90.4886755576376

end = date.today() - timedelta(days=7)
start = end - timedelta(days=90)

series, source, sources = registry.fetch_with_fallback(
    field_id="ndvi_diagnostic_test",
    lat=lat,
    lon=lon,
    start=start,
    end=end,
    refresh=True,
)

values = series.get("ndvi", [])
dates = series.get("dates", [])

valid = [
    (day, value)
    for day, value in zip(dates, values)
    if value is not None and value != FILL_VALUE
]

print("\n===== FUTUREFIELD NDVI DIAGNOSTIC =====")
print("Source:", source)
print("NASA Sources:", sources)
print("Total days:", len(values))
print("Valid NDVI days:", len(valid))
print("Latest NDVI:", valid[-1] if valid else None)
print("======================================")