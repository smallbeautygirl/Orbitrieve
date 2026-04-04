from __future__ import annotations


class OrbitrieveError(Exception):
    """Base exception for all Orbitrieve errors."""


class SearchError(OrbitrieveError):
    """Raised when Tavily search fails."""


class AgentError(OrbitrieveError):
    """Raised when a Claude agent call fails."""
