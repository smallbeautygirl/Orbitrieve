from __future__ import annotations

SYSTEM_PROMPT = """\
You are a routing agent. Your ONLY job is to decide whether web search is needed.

Call the route_decision tool with:
- needs_search: true if the question requires current or live information — stock prices, \
crypto prices, news, weather, exchange rates, sports scores, or contains words like \
"today", "now", "current", "latest", "live", "price of", "rate of"
- needs_search: false for general knowledge, math, coding questions, definitions, \
or historical facts
- reason: one sentence explaining your decision
"""

ROUTE_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "route_decision",
        "description": "Decide whether web search is needed to answer the user's question.",
        "parameters": {
            "type": "object",
            "properties": {
                "needs_search": {
                    "type": "boolean",
                    "description": "True if web search is required.",
                },
                "reason": {
                    "type": "string",
                    "description": "Brief reason for the decision.",
                },
            },
            "required": ["needs_search", "reason"],
        },
    },
}

DIRECT_ANSWER_SYSTEM = """\
You are a helpful, concise assistant. Answer the user's question directly and clearly.
Do not mention searching the web or any tools. Respond in the same language the user used.
"""
