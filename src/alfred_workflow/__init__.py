# Path: src/alfred_workflow/__init__.py

def __getattr__(name):
    if name == "build_workflow":
        from .workflow_builder import build_workflow
        return build_workflow
    if name == "search_suttas":
        from .search_logic import search_suttas
        return search_suttas
    raise AttributeError(f"module {__name__} has no attribute {name}")

__all__ = ["build_workflow", "search_suttas"]

