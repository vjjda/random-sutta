# Path: src/dict_builder/logic/ebts_loader.py
import pickle
from pathlib import Path
from rich import print

from src.dict_builder.tools.text_scanner import get_ebts_word_set

def load_cached_ebts_words(bilara_path: Path, books: list, cache_dir: Path) -> set:
    """
    Load EBTS word set.
    Delegates caching responsibility to text_scanner.py.
    """
    # Simply call the scanner. It handles its own v5 compressed cache.
    return get_ebts_word_set(bilara_path, books)