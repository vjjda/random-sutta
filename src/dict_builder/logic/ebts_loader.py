# Path: src/dict_builder/logic/ebts_loader.py
import pickle
from pathlib import Path
from rich import print

from src.dict_builder.tools.text_scanner import get_ebts_word_set

def load_cached_ebts_words(bilara_path: Path, books: list, cache_dir: Path) -> set:
    """
    Load EBTS word set with caching (pickle).
    """
    if not cache_dir.exists():
        cache_dir.mkdir(parents=True, exist_ok=True)
        
    cache_file = cache_dir / "ebts_word_set.pickle"
    
    # Simple cache invalidation: if bilara folder modified time > cache file
    # But checking bilara folder recursively is slow.
    # For now, just check existence. User can delete cache to force rebuild.
    
    if cache_file.exists():
        print("[cyan]Loading EBTS word set from cache (pickle)...")
        try:
            with open(cache_file, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            print(f"[red]Cache load failed ({e}), rebuilding...")
    
    print("[yellow]Calculating EBTS word set from source (slow)...")
    target_set = get_ebts_word_set(bilara_path, books)
    
    try:
        print("[cyan]Saving EBTS word set to cache...")
        with open(cache_file, "wb") as f:
            pickle.dump(target_set, f)
    except Exception as e:
        print(f"[red]Failed to save cache: {e}")
        
    return target_set