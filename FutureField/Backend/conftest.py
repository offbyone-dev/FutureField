"""Force mock NASA during pytest so CI does not call live services."""
import os

os.environ["USE_MOCK_NASA"] = "true"
