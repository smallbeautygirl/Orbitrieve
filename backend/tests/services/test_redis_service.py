# backend/tests/services/test_redis_service.py
from __future__ import annotations
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.redis_service import RedisService
from app.models.chat import ChatMessage


@pytest.fixture
def mock_redis():
    r = MagicMock()
    r.get = AsyncMock(return_value=None)
    r.setex = AsyncMock()
    r.delete = AsyncMock()
    return r


@pytest.fixture
def svc(mock_redis):
    return RedisService(redis=mock_redis)


async def test_get_history_returns_empty_when_no_key(svc, mock_redis):
    mock_redis.get.return_value = None
    result = await svc.get_history("conv-123")
    assert result == []


async def test_get_history_returns_messages_from_redis(svc, mock_redis):
    stored = [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]
    mock_redis.get.return_value = json.dumps(stored).encode()
    result = await svc.get_history("conv-123")
    assert len(result) == 2
    assert result[0].role == "user"
    assert result[1].content == "Hi"


async def test_append_turn_calls_setex_with_ttl(svc, mock_redis):
    mock_redis.get.return_value = None
    user_msg = ChatMessage(role="user", content="What's the weather?")
    assistant_msg = ChatMessage(role="assistant", content="It's sunny.")
    await svc.append_turn("conv-123", user_msg, assistant_msg)
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert args[0] == "conversation:conv-123"
    assert args[1] == 86400


async def test_append_turn_truncates_history_over_40_messages(svc, mock_redis):
    old_history = [{"role": "user", "content": f"msg {i}"} for i in range(40)]
    mock_redis.get.return_value = json.dumps(old_history).encode()
    user_msg = ChatMessage(role="user", content="new")
    assistant_msg = ChatMessage(role="assistant", content="reply")
    await svc.append_turn("conv-123", user_msg, assistant_msg)
    saved = json.loads(mock_redis.setex.call_args[0][2])
    assert len(saved) == 40


async def test_clear_deletes_key(svc, mock_redis):
    await svc.clear("conv-123")
    mock_redis.delete.assert_called_once_with("conversation:conv-123")
