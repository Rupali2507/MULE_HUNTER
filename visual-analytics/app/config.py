import os

BACKEND_BASE_URL = os.getenv(
    "BACKEND_BASE_URL",
    "http://localhost:8080"
)

REQUEST_TIMEOUT = 30
