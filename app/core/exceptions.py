"""Standardized safe errors: never return request values, exception text, or traces."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from src.data_loader import FEATURES


class ErrorDetail(BaseModel):
    field: str
    code: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody


class ServiceError(Exception):
    """Carry only deliberately public error messages across service/HTTP boundaries."""
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code, self.code, self.public_message = status_code, code, message


def error_response(status: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details or []}})


def register_handlers(app: FastAPI) -> None:
    """Install handlers whose output does not contain Pydantic input/context data."""
    @app.exception_handler(ServiceError)
    async def service_error(request: Request, error: ServiceError) -> JSONResponse:
        return error_response(error.status_code, error.code, error.public_message)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError) -> JSONResponse:
        errors = error.errors()
        if request.url.path == '/api/v1/reports/explain':
            malformed = any(item['type'] == 'json_invalid' for item in errors)
            return error_response(400 if malformed else 422,
                'malformed_json' if malformed else 'report_explanation_validation',
                'Use valid JSON.' if malformed else
                'Use only transcription-reviewed synthetic measurements with supported names, finite numbers, unique IDs, ordered printed bounds and matching supported units; choose en, fr or ar. Unreviewed measurements are excluded: confirm them or remove them before retrying.')
        malformed = any(item["type"] == "json_invalid" for item in errors)
        messages = {"missing": "Required field is missing.", "extra_forbidden": "Unexpected fields are not allowed.",
                    "float_type": "Use a JSON number or null.", "int_type": "Use a JSON integer category or null.",
                    "finite_number": "Use a finite number or null.", "unknown_category": "Use a documented UCI category or null.",
                    "greater_than_equal": "Value is outside the supported training range.",
                    "less_than_equal": "Value is outside the supported training range.",
                    "empty_record": "At least one input must be non-null.", "json_invalid": "Body must contain valid JSON."}
        details = []
        for item in errors:
            field = next((str(part) for part in item["loc"] if part in FEATURES), "body")
            details.append({"field": field, "code": item["type"], "message": messages.get(item["type"], "Provide one object matching the documented schema.")})
        return error_response(400 if malformed else 422, "malformed_json" if malformed else "validation_error",
                              "Body must contain valid JSON." if malformed else "Request validation failed.", details)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        messages = {400: "Bad request.", 404: "Endpoint not found.", 405: "Method not allowed."}
        response = error_response(error.status_code, "http_error", messages.get(error.status_code, "Request could not be completed."))
        if error.headers and "Allow" in error.headers:
            response.headers["Allow"] = error.headers["Allow"]
        return response
