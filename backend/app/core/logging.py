from __future__ import annotations

import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    )
