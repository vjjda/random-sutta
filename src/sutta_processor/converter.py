# Path: src/sutta_processor/converter.py
import json
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, List

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def get_file_path(sutta_id: str, category: str, author_uid: str = None) -> Optional[Path]:
    if category == "translation":
        if not author_uid: return None
        base = DATA_ROOT / "translation" / "en" / author_uid
        pattern = f"{sutta_id}_translation-en-{author_uid}.json"
    
    elif category == "html":
        base = DATA_ROOT / "html"
        pattern = f"{sutta_id}_html.json"
        
    elif category == "comment":
        base = DATA_ROOT / "comment" / "en"
        pattern = f"{sutta_id}_comment-en-*.json"
    
    else:
        return None

    if not base.exists(): return None
    found = list(base.rglob(pattern))
    return found[0] if found else None

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def process_worker(args: Tuple[str, Path, Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    sutta_id, root_path, author_uid = args
    
    try:
        trans_path = get_file_path(sutta_id, "translation", author_uid) if author_uid else None
        html_path = get_file_path(sutta_id, "html")
        comment_path = get_file_path(sutta_id, "comment")

        if not html_path:
            return "skipped", sutta_id, None

        data_root = load_json(root_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)

        all_keys = set(data_root.keys()) | set(data_html.keys())
        if data_trans:
            all_keys |= set(data_trans.keys())
            
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        # [UPDATE] Chuyển segments thành Dictionary
        segments = {} 
        has_content = False
        
        for key in sorted_keys:
            pali = data_root.get(key)
            eng = data_trans.get(key)
            html = data_html.get(key)
            comm = data_comment.get(key)
            
            if not (pali or eng or html):
                continue

            has_content = True
            
            # Key chính là segment ID, value là nội dung
            entry = {}
            if pali: entry["pli"] = pali
            if eng: entry["en"] = eng
            if html: entry["html"] = html
            if comm: entry["comm"] = comm
            
            segments[key] = entry

        if not has_content:
             return "skipped", sutta_id, None

        final_data = {
            "author_uid": author_uid,
            "segments": segments # Dict[str, Dict]
        }

        return "success", sutta_id, final_data

    except Exception as e:
        return "error", sutta_id, None