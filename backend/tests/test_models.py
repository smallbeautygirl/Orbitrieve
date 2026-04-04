from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.chat import ChatMessage, ChatRequest, Source


def test_chat_request_rejects_empty_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="", conversation_id="abc123", history=[])


def test_chat_request_rejects_message_over_4000_chars():
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 4001, conversation_id="abc123", history=[])


def test_chat_request_valid():
    req = ChatRequest(message="Hello", conversation_id="abc123", history=[])
    assert req.message == "Hello"
    assert req.history == []


def test_source_model():
    s = Source(index=1, title="Reuters", url="https://reuters.com", snippet="News snippet")
    assert s.index == 1
