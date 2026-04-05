from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class Source(BaseModel):
    index: int
    title: str
    url: str
    snippet: str
    published_date: str | None = None
