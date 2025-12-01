# Path: src/sutta_processor/converter.py
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

def localize_links(text: str) -> str:
    if not text:
        return ""

    
    
    
    
    
    pattern = r'https://suttacentral\.net/([a-zA-Z0-9\.-]+)/[a-z]+/[a-z0-9-]+(?:#([a-zA-Z0-9\.:-]+))?'
    
    def replacer(match):
        sutta_id = match.group(1)
        segment = match.group(2)
        
        new_url = f"index.html?q={sutta_id}"
        
        if segment:
            
            
            if ":" in segment:
                segment = segment.split(":", 1)[1]
            new_url += f"#{segment}"
            
        return new_url

    return re.sub(pattern, replacer, text)

def process_worker(args: Tuple[str, Path]) -> Tuple[str, str, Optional[str]]:
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

            
            if ":" in key:
                short_id = key.split(":", 1)[1]
            else:
                short_id = key

            
            segment_content = f"<span class='segment' id='{short_id}' data-uid='{key}'>"
            
            if pali_text:
                segment_content += f"<span class='pli'>{pali_text}</span>"
            
            if eng_text:
                segment_content += f" <span class='eng'>{eng_text}</span>"
                
            if comment_text:
                
                processed_comment = localize_links(comment_text)
                
                
                safe_comment = processed_comment.replace('"', '&quot;').replace("'", "&#39;")
                
                segment_content += f" <span class='comment-marker' data-comment='{safe_comment}'>*</span>"
            
            segment_content += "</span>"
            
            final_html += template.replace("{}", segment_content) + "\n"

        return group, sutta_id, final_html

    except Exception as e:
        print(f"Error in {sutta_id}: {e}")
        return "error", sutta_id, None