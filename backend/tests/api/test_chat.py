# backend/tests/api/test_chat.py
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_chat_rejects_empty_message():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/chat",
            json={"message": "", "conversation_id": "test-uuid", "history": []},
        )
    assert response.status_code == 422


async def test_chat_returns_sse_stream_for_valid_request():
    mock_raw_redis = AsyncMock()
    mock_raw_redis.aclose = AsyncMock()
    with (
        patch("app.api.chat.OrchestratorAgent") as mock_orch_cls,
        patch("app.api.chat.RedisService") as mock_redis_cls,
        patch("app.api.chat._get_redis", return_value=mock_raw_redis),
    ):
        mock_redis_cls.return_value.get_history = AsyncMock(return_value=[])
        mock_redis_cls.return_value.append_turn = AsyncMock()

        mock_orch = MagicMock()
        mock_orch_cls.return_value = mock_orch

        from app.agents.orchestrator import RouteDecision

        mock_orch.decide = AsyncMock(return_value=RouteDecision(needs_search=False, reason="simple"))

        async def mock_answer_directly(*args, **kwargs):
            yield json.dumps({"type": "token", "content": "Hello!"})
            yield json.dumps({"type": "done"})

        mock_orch.answer_directly = mock_answer_directly

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            async with client.stream(
                "POST",
                "/api/chat",
                json={"message": "Hello", "conversation_id": "test-uuid", "history": []},
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]


async def test_health_endpoint_returns_ok():
    with patch("app.api.chat._get_redis") as mock_get_redis:
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock()
        mock_redis.aclose = AsyncMock()
        mock_get_redis.return_value = mock_redis
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
