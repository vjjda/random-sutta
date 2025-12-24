# Path: src/dict_builder/logic/batch_worker.py
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_batch_worker(ids: List[int], config: BuilderConfig) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        for i in headwords:
            # Render HTML
            grammar = renderer.render_grammar(i)
            examples = renderer.render_examples(i)
            definition = renderer.render_entry(i)
            
            # [UPDATED] Lấy ebt_count làm search_score
            # Nếu ebt_count là None thì mặc định là 0
            score = i.ebt_count if i.ebt_count else 0
            
            # Data cho bảng entries (Bỏ data_json)
            entries_data.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                definition,
                grammar,
                examples,
                score 
            ))
            
            # Data cho bảng lookups
            lookups_data.append((i.lemma_clean, i.id, 'entry', 0))
            for inf in i.inflections_list_all:
                if inf:
                    lookups_data.append((inf, i.id, 'entry', 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data