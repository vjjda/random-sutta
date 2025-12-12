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

# [UPDATED] Tuple chứ 7 phần tử cho báo cáo chi tiết
# (sutta, segment, link_origin, mentioned_url, anchor_text, miss_uid, hash_id)
MissingItem = Tuple[str, str, str, str, str, str, str]

def _sanitize_links(text: str, current_sutta_id: str, segment_id: str, missing_acc: List[MissingItem]) -> str:
    if not text or "suttacentral.net" not in text:
        return text

    # [NEW REGEX] Capture full <a> tag context
    # Gr 1: Prefix (<a ... href=')
    # Gr 2: Full URL
    # Gr 3: Raw UID capture
    # Gr 4: URL Tail (path + hash)
    # Gr 5: Suffix (' ... >)
    # Gr 6: Anchor Text
    # Gr 7: Closing Tag (</a>)
    pattern = r"(<a\b[^>]*href=['\"])(https?://suttacentral\.net/([a-zA-Z0-9\.-]+)([^'\"\s]*))(['\"][^>]*>)(.*?)(</a>)"
    
    def repl(match):
        prefix = match.group(1)
        full_url = match.group(2)
        uid_raw = match.group(3)
        url_tail = match.group(4)
        suffix = match.group(5)
        anchor_text = match.group(6)
        closing = match.group(7)
        
        target_uid = _get_base_uid(uid_raw)
        
        # Extract Hash
        hash_id = ""
        hash_match = re.search(r"#([a-zA-Z0-9\.\:-]+)", url_tail)
        if hash_match:
            hash_id = hash_match.group(1)

        # 1. Check Valid
        if target_uid in _WORKER_VALID_UIDS:
            new_href = f"index.html?q={target_uid}"
            if hash_id:
                new_href += f"#{hash_id}"
            # Reconstruct tag with internal link
            return f"{prefix}{new_href}{suffix}{anchor_text}{closing}"
        
        # 2. Log Missing (Nếu là link kinh điển hợp lệ)
        if re.match(r"^[a-z]", target_uid, re.I) and any(c.isdigit() for c in target_uid):
             logger.warning(f"   ⚠️  [{current_sutta_id}] Seg '{segment_id}': Missing '{target_uid}' ({anchor_text})")
             
             # Construct Source Link (Link của đoạn hiện tại trên SC)
             # Format: https://suttacentral.net/{sutta}/en/sujato/{segment}
             # Lưu ý: segment_id thường là "mn4:2.3", ta giữ nguyên hoặc chỉ lấy phần sau ":" tùy nhu cầu.
             # Ở đây dùng nguyên segment_id để chính xác nhất.
             source_link = f"https://suttacentral.net/{current_sutta_id}/en/sujato/{segment_id}"

             missing_acc.append((
                 current_sutta_id,  # sutta
                 segment_id,        # segment
                 source_link,       # link (source)
                 full_url,          # mentioned
                 anchor_text,       # anchor_text
                 target_uid,        # miss_uid
                 hash_id            # hash_id
             ))
        
        return match.group(0) # Keep original

    return re.sub(pattern, repl, text, flags=re.IGNORECASE)

def process_worker(args: Tuple[str, Path, Optional[Path], Optional[Path], Optional[Path], Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]], List[MissingItem]]:
    sutta_id, root_path, trans_path, html_path, comment_path, author_uid = args
    missing_refs: List[MissingItem] = []
    
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