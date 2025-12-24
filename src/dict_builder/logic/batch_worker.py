# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def compress_html(html_str: str) -> bytes:
    """Nén chuỗi HTML thành bytes bằng zlib."""
    if not html_str:
        return None
    return zlib.compress(html_str.encode('utf-8'))

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
            
            score = i.ebt_count if i.ebt_count else 0
            
            # [OPTIMIZED] Nén dữ liệu HTML
            entries_data.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                compress_html(definition),
                compress_html(grammar_html),
                compress_html(examples),
                score 
            ))
            
            # [OPTIMIZED] Lookups: target_type (0=entry), is_inflection (0/1)
            # Headword chính
            lookups_data.append((i.lemma_clean, i.id, 0, 0))
            
            # Các biến thể
            for inf in i.inflections_list_all:
                if inf:
                    lookups_data.append((inf, i.id, 0, 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data