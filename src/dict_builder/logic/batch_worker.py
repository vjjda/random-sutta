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
            # [CHANGED] Thay render_grammar bằng extract_grammar_data
            grammar_json = renderer.extract_grammar_data(i)
            
            examples = renderer.render_examples(i)
            definition = renderer.render_entry(i)
            
            score = i.ebt_count if i.ebt_count else 0
            
            entries_data.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                definition,
                grammar_json, # JSON string
                examples,
                score 
            ))
            
            lookups_data.append((i.lemma_clean, i.id, 'entry', 0))
            for inf in i.inflections_list_all:
                if inf:
                    lookups_data.append((inf, i.id, 'entry', 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data