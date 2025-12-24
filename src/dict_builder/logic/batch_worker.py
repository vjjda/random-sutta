# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_html(html_str: str, compress: bool) -> str | bytes:
    """Xử lý HTML: Nén nếu cần, không thì trả về string gốc."""
    if not html_str:
        return None
    
    if compress:
        return zlib.compress(html_str.encode('utf-8'))
    
    return html_str

def process_batch_worker(ids: List[int], config: BuilderConfig) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        for i in headwords:
            # Render HTML
            grammar_html = renderer.render_grammar(i)
            examples = renderer.render_examples(i)
            definition = renderer.render_entry(i)
            
            # [CHANGED] Xử lý nén tùy theo config
            entries_data.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                process_html(definition, config.USE_COMPRESSION),
                process_html(grammar_html, config.USE_COMPRESSION),
                process_html(examples, config.USE_COMPRESSION)
                # [REMOVED] score
            ))
            
            # [CHANGED] Lookups logic: 
            # is_headword = 1 (True) -> Đây là từ trong bảng entries
            
            # 1. Headword chính
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            
            # 2. Các biến thể (Inflections)
            for inf in i.inflections_list_all:
                if inf:
                    # Vẫn trỏ về bảng entries (is_headword=1), nhưng là biến thể (is_inflection=1)
                    lookups_data.append((inf, i.id, 1, 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data