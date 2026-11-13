import os
import tempfile

# Must run before the app is imported so tests never touch real data/
os.environ["FUTUREFIELD_DATA_DIR"] = tempfile.mkdtemp()
os.environ["USE_MOCK_NASA"] = "true"
