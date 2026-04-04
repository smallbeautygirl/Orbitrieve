# backend/app/main.py
from __future__ import annotations

from fastapi import FastAPI

from app.api.chat import router
from app.core.logging import setup_logging
from app.core.middleware import add_cors

setup_logging()

app = FastAPI(title="Orbitrieve", version="1.0.0")
add_cors(app)
app.include_router(router)
