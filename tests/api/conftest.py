"""API-only fixtures; previous-phase tests and fixtures are preserved."""

import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app
from app.schemas.patient import DEMO_RECORD


@pytest.fixture(scope="session")
def api_application():
    return create_app(Settings(_env_file=None))


@pytest.fixture(scope="session")
def api_client(api_application):
    with TestClient(api_application, raise_server_exceptions=False) as client:
        assert client.get("/api/v1/ready").status_code == 200
        yield client


@pytest.fixture
def clinical_record():
    """A fabricated input example, not a patient's record or fabricated prediction."""
    return dict(DEMO_RECORD)
