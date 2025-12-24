# Path: src/__init__.py
# Old exports removed. New unified entry point via data_fetcher module.
from .data_fetcher import run_cli

__all__ = ["run_cli"]