# Path: src/sutta_processor/logic/content_merger.py
import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, FrozenSet, List

logger = logging.getLogger("SuttaProcessor.Logic.Merger")

_WORKER_VALID_UIDS: FrozenSet[str] = frozenset()

def init_worker(valid_uids: FrozenSet[str]) -> None:
    global _WORKER_VALID_UIDS
    _WORKER_VALID_UIDS = valid_uids

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _get_base_uid(uid: str) -> str:
    base = uid.split('#')[0]
    base = base.split(':')[0]
    return base.lower()

def _sanitize_links(text: str, current_sutta_id: str, segment_id: str, missing_acc: List[Tuple[str, str, str]]) -> str:
    if not text or "suttacentral.net" not in text:
        return text

    # [SIMPLIFIED REGEX]
    # 1. Domain: https://suttacentral.net/
    # 2. Group 1 (UID): [a-zA-Z0-9\.-]+ (Bắt UID ngay sau domain)
    # 3. Group 2 (Tail): [^"'\s]* (Nuốt hết phần còn lại cho đến khi gặp dấu nháy hoặc khoảng trắng)
    pattern = r"https?://suttacentral\.net/([a-zA-Z0-9\.-]+)([^\"'\s]*)"
    
    def repl(match):
        uid_raw = match.group(1) 
        url_tail = match.group(2) # Chứa path (/lzh/taisho) và hash (#segment)
        
        target_uid = _get_base_uid(uid_raw)
        
        # Tìm Fragment trong phần đuôi (nếu có)
        fragment = ""
        hash_match = re.search(r"#([a-zA-Z0-9\.\:-]+)", url_tail)
        if hash_match:
            fragment = hash_match.group(1)

        # Check Existence
        if target_uid in _WORKER_VALID_UIDS:
            new_link = f"index.html?q={target_uid}"
            if fragment:
                new_link += f"#{fragment}"
            return new_link
        
        # [BROADENED CHECK] Logic cảnh báo nới lỏng
        # Điều kiện: Bắt đầu bằng chữ cái VÀ chứa ít nhất 1 chữ số
        # Ví dụ khớp: mn1, ea31.1, pli-tv-bi-vb-pc1
        # Ví dụ bỏ qua: home, about, discussion
        if re.match(r"^[a-z]", target_uid, re.I) and any(c.isdigit() for c in target_uid):
             # Log warning ra console
             logger.warning(f"   ⚠️  [{current_sutta_id}] Seg '{segment_id}': Missing link '{target_uid}'")
             missing_acc.append((current_sutta_id, segment_id, target_uid))
        
        return match.group(0)

    return re.sub(pattern, repl, text)

def process_worker(args: Tuple[str, Path, Optional[Path], Optional[Path], Optional[Path], Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]], List[Tuple[str, str, str]]]:
    sutta_id, root_path, trans_path, html_path, comment_path, author_uid = args
    missing_refs: List[Tuple[str, str, str]] = []
    
    try:
        if not html_path:
            return "skipped", sutta_id, None, []

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
            
            if comm: entry["comm"] = _sanitize_links(comm, sutta_id, key, missing_refs)
            
            segments_dict[key] = entry

        if not has_content:
             return "skipped", sutta_id, None, []

        final_data = {
            "author_uid": author_uid,
            "data": segments_dict 
        }

        return "success", sutta_id, final_data, missing_refs

    except Exception as e:
        logger.error(f"Error processing {sutta_id}: {e}")
        return "error", sutta_id, None, []