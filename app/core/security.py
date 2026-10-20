"""Bound request bodies and prevent accidental disclosure in unexpected failures."""

import logging
import asyncio
from threading import BoundedSemaphore
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.middleware.cors import CORSMiddleware
from .exceptions import error_response

LOGGER = logging.getLogger("medintel.api")


class ControlledCORSMiddleware(CORSMiddleware):
    """Keep rejected preflight responses in the same safe JSON error envelope."""

    def preflight_response(self, request_headers):
        response = super().preflight_response(request_headers)
        if response.status_code >= 400:
            safe = error_response(400, "cors_not_allowed", "CORS preflight was not permitted.")
            for name, value in response.headers.items():
                if name.lower() not in {"content-type", "content-length"}:
                    safe.headers[name] = value
            return safe
        return response


class PrivacyMiddleware:
    """ASGI byte limits cover streamed bodies even when Content-Length is absent/wrong."""

    def __init__(self, app: ASGIApp, max_request_bytes: int, report_max_bytes: int = 5 * 1024 * 1024):
        self.app, self.limit = app, max_request_bytes
        self.report_limit = report_max_bytes + 65_536
        self.report_slot = BoundedSemaphore(1)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        is_report = scope['type'] == 'http' and scope.get('path') == '/api/v1/reports/extract' and scope.get('method') == 'POST'
        if is_report:
            if not self.report_slot.acquire(blocking=False):
                response = error_response(429, 'report_busy', 'Another synthetic report is being processed. Try again shortly.')
                response.headers.update({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'})
                await response(scope, receive, send)
                return
            try:
                await self._handle(scope, receive, send, True)
            finally:
                self.report_slot.release()
        else:
            await self._handle(scope, receive, send, False)

    async def _handle(self, scope: Scope, receive: Receive, send: Send, is_report: bool) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def protected_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                headers = [(key, value) for key, value in message.get("headers", [])
                           if key.lower() not in {b"cache-control", b"x-content-type-options", b"referrer-policy"}]
                headers.extend([(b"cache-control", b"no-store"), (b"x-content-type-options", b"nosniff"),
                                (b"referrer-policy", b"no-referrer")])
                message = {**message, "headers": headers}
            await send(message)

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        # Structured review may contain 50 rows and Unicode labels, with no raw document text.
        is_report_explanation = scope.get('path') == '/api/v1/reports/explain' and scope.get('method') == 'POST'
        limit = self.report_limit if is_report else 65_536 if is_report_explanation else self.limit
        try:
            length = int(headers.get(b"content-length", b"0"))
            if length < 0:
                raise ValueError
        except ValueError:
            await error_response(400, "invalid_content_length", "Invalid Content-Length header.")(scope, receive, protected_send)
            return
        if length > limit:
            await error_response(413, "request_too_large", "Request body exceeds the configured byte limit.")(scope, receive, protected_send)
            return
        if scope["method"] in {"POST", "PUT", "PATCH"}:
            content_type = headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower()
            expected = b'multipart/form-data' if is_report else b'application/json'
            if content_type != expected:
                await error_response(415, "unsupported_media_type", 'Use multipart/form-data for report extraction.' if is_report else 'Use application/json.')(scope, receive, protected_send)
                return
            if headers.get(b"content-encoding", b"identity").lower() != b"identity":
                await error_response(415, "unsupported_encoding", "Compressed request bodies are not supported.")(scope, receive, protected_send)
                return
            chunks, total = [], 0
            deadline = asyncio.get_running_loop().time() + 20 if is_report else None
            while True:
                try:
                    timeout = max(0.001, min(15, deadline - asyncio.get_running_loop().time())) if deadline else None
                    message = await asyncio.wait_for(receive(), timeout=timeout)
                except TimeoutError:
                    await error_response(408, 'upload_timeout', 'Upload stalled before the request body was complete.')(scope, receive, protected_send)
                    return
                if message["type"] == "http.disconnect":
                    return
                total += len(message.get("body", b""))
                if total > limit:
                    await error_response(413, "request_too_large", "Request body exceeds the configured byte limit.")(scope, receive, protected_send)
                    return
                chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    break
            body, consumed = b"".join(chunks), False

            async def replay():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()
        else:
            replay = receive
        try:
            await self.app(scope, replay, protected_send)
        except Exception:
            # Never interpolate exception strings, URLs, payloads, or stack traces.
            LOGGER.error("Inference request failed; internal details suppressed.")
            if started:
                raise
            await error_response(500, "internal_error", "The request could not be completed.")(scope, replay, protected_send)
