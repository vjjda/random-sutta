# Path: src/sutta_processor/logic/content_merger.py
import json
import logging
import re  # [NEW] Import Regex
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, Set

from ..shared.app_config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor.Logic.Merger")

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

def _sanitize_links(text: str) -> str:
    """
    Chuyển đổi link SuttaCentral sang link Local.
    Input:  https://suttacentral.net/mn1/en/sujato#2.3
    Output: index.html?q=mn1#2.3
    
    Pattern bắt:
    1. Base: https://suttacentral.net/
    2. Group 1 (ID): mn1
    3. Phần giữa: /en/sujato (hoặc bất kỳ lang/author nào)
    4. Group 2 (Hash): #2.3 (Optional)
    """
    if not text or "suttacentral.net" not in text:
        return text

    # Regex giải thích:
    # https://suttacentral\.net/  -> Prefix
    # ([a-zA-Z0-9\.-]+)           -> Group 1: UID (ví dụ: mn1, an1.1)
    # /                           -> Slash
    # [^/]+/[^/#"']+              -> Bỏ qua phần Lang và Author (ví dụ: en/sujato)
    # (?:#([a-zA-Z0-9\.\:-]+))?   -> Group 2: Hash (Optional), non-capturing group cho dấu #
    pattern = r"https://suttacentral\.net/([a-zA-Z0-9\.-]+)/[^/]+/[^/#\"']+(?:#([a-zA-Z0-9\.\:-]+))?"
    
    def repl(match):
        uid = match.group(1)
        fragment = match.group(2)
        
        # Tạo link local
        new_link = f"index.html?q={uid}"
        if fragment:
            new_link += f"#{fragment}"
        return new_link

    return re.sub(pattern, repl, text)

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

        segments_dict = {} 
        has_content = False
        
        for key in sorted_keys:
            pali = data_root.get(key)
            eng = data_trans.get(key)
            html = data_html.get(key)
            comm = data_comment.get(key)
            
            if not (pali or eng or html):
                continue

            has_content = True
            
            entry = {}
            if pali: entry["pli"] = pali
            if eng: entry["eng"] = eng
            if html: entry["html"] = html
            
            # [UPDATED] Xử lý link trong comment trước khi lưu
            if comm: 
                entry["comm"] = _sanitize_links(comm)
            
            segments_dict[key] = entry

        if not has_content:
             return "skipped", sutta_id, None

        final_data = {
            "author_uid": author_uid,
            "data": segments_dict 
        }

        return "success", sutta_id, final_data

    except Exception as e:
        logger.error(f"Error processing {sutta_id}: {e}")
        return "error", sutta_id, None