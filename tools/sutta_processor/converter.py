# Path: tools/sutta_processor/converter.py
import json
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from .finder import find_sutta_files, get_group_name

def load_json(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def process_worker(args: Tuple[str, Path]) -> Tuple[str, str, Optional[str]]:
    """
    Worker function to be run in parallel.
    Returns: (group_name, sutta_id, html_content)
    """
    sutta_id, root_file_path = args
    
    try:
        files = find_sutta_files(sutta_id, root_file_path)
        
        if not files.get('root') or not files.get('html'):
            return "skipped", sutta_id, None

        group = get_group_name(files['root'])

        data_root = load_json(files['root'])
        data_trans = load_json(files.get('translation', Path("")))
        data_html = load_json(files.get('html', Path("")))
        data_comment = load_json(files.get('comment', Path("")))

        sorted_keys = sorted(data_html.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

        final_html = ""
        for key in sorted_keys:
            template = data_html.get(key, "{}")
            pali_text = data_root.get(key, "")
            eng_text = data_trans.get(key, "")
            comment_text = data_comment.get(key, "")

            # --- WRAPPER START ---
            # Bọc toàn bộ nội dung của segment vào span có id là segment_id (ví dụ: mn1:1.1)
            # class 'segment' dùng để style hoặc query sau này
            segment_content = f"<span class='segment' id='{key}'>"
            
            if pali_text:
                segment_content += f"<span class='pli'>{pali_text}</span>"
            
            if eng_text:
                segment_content += f" <span class='eng'>{eng_text}</span>"
                
            if comment_text:
                safe_comment = comment_text.replace('"', '&quot;').replace("'", "&#39;")
                segment_content += f" <span class='comment-marker' data-comment='{safe_comment}'>*</span>"
            
            segment_content += "</span>"
            # --- WRAPPER END ---

            final_html += template.replace("{}", segment_content) + "\n"

        return group, sutta_id, final_html

    except Exception as e:
        print(f"Error in {sutta_id}: {e}")
        return "error", sutta_id, None