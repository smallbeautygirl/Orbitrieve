# backend/app/services/redis_service.py
from __future__ import annotations

import json
import logging

from redis.asyncio import Redis

from app.models.chat import ChatMessage

logger = logging.getLogger(__name__)

HISTORY_TTL = 86400  # 24 hours
MAX_HISTORY_MESSAGES = 20  # 10 turns


class RedisService:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get_history(self, conversation_id: str) -> list[ChatMessage]:
        key = f"conversation:{conversation_id}"
        data = await self._redis.get(key)
        if data is None:
            return []
        return [ChatMessage(**m) for m in json.loads(data)]

    async def append_turn(
        self,
        conversation_id: str,
        user_msg: ChatMessage,
        assistant_msg: ChatMessage,
    ) -> None:
        key = f"conversation:{conversation_id}"
        history = await self.get_history(conversation_id)
        history.extend([user_msg, assistant_msg])
        if len(history) > MAX_HISTORY_MESSAGES:
            history = history[-MAX_HISTORY_MESSAGES:]
        payload = json.dumps([m.model_dump() for m in history])
        await self._redis.setex(key, HISTORY_TTL, payload)
        logger.debug("History appended", extra={"conversation_id": conversation_id, "length": len(history)})

    async def clear(self, conversation_id: str) -> None:
        await self._redis.delete(f"conversation:{conversation_id}")
        logger.info("History cleared", extra={"conversation_id": conversation_id})
