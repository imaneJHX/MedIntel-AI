"""Environment-based settings; no model downloads or credentials are configured."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Local-only defaults; lists in environment variables must be JSON arrays."""

    model_config = SettingsConfigDict(env_prefix="MEDINTEL_", env_file=PROJECT_ROOT / ".env", extra="ignore")
    project_root: Path = PROJECT_ROOT
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
    cors_allow_credentials: bool = False
    max_request_bytes: int = Field(default=16_384, ge=512, le=1_048_576)
    report_max_bytes: int = Field(default=5 * 1024 * 1024, ge=1024, le=5 * 1024 * 1024)
    report_max_pages: int = Field(default=5, ge=1, le=5)
    report_timeout_seconds: int = Field(default=40, ge=5, le=60)
    report_ocr_timeout_seconds: int = Field(default=8, ge=1, le=15)
    tesseract_command: str = ''

    @field_validator("project_root")
    @classmethod
    def absolute_root(cls, value: Path) -> Path:
        return value.resolve()

    @field_validator("cors_origins")
    @classmethod
    def explicit_origins(cls, values: list[str]) -> list[str]:
        for value in values:
            parsed = urlsplit(value)
            if (value == "*" or parsed.scheme not in {"http", "https"} or not parsed.hostname
                    or parsed.username or parsed.password or parsed.query or parsed.fragment
                    or parsed.path not in {"", "/"} or "*" in value):
                raise ValueError("Use explicit HTTP(S) origins without credentials, paths, queries, or wildcards.")
        return [value.rstrip("/") for value in values]
