# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple, Set, Optional
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword, Lookup
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_data(data_str: str, compress: bool) -> str | bytes:
    """Hàm helper để nén dữ liệu nếu cần."""
    if not data_str:
        return None
    if compress:
        return zlib.compress(data_str.encode('utf-8'))
    return data_str

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        for i in headwords:
            # 1. Definition JSON (Dùng chung cho cả Tiny và Mini)
            definition_json = renderer.extract_definition_json(i)
            
            if config.is_tiny_mode:
                # Tiny: Chỉ lưu definition
                entries_data.append((
                    i.id,
                    i.lemma_1,
                    i.lemma_clean,
                    process_data(definition_json, config.USE_COMPRESSION)
                ))
            else:
                # Mini: Lưu Definition, Grammar, Example đều dạng JSON
                grammar_json = renderer.extract_grammar_json(i)
                example_json = renderer.extract_example_json(i)
                
                entries_data.append((
                    i.id,
                    i.lemma_1,
                    i.lemma_clean,
                    process_data(definition_json, config.USE_COMPRESSION),
                    process_data(grammar_json, config.USE_COMPRESSION),
                    process_data(example_json, config.USE_COMPRESSION)
                ))
            
            # --- Logic Lookups (Giữ nguyên) ---
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            unique_infs = set(i.inflections_list_all)
            
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean:
                    continue
                if target_set is not None and inf not in target_set:
                    continue
                lookups_data.append((inf, i.id, 1, 1))
                    
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data

# ... (Hàm process_decon_worker giữ nguyên) ...
def process_decon_worker(keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    decon_batch = []
    decon_lookup_batch = []
    current_id = start_id
    try:
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        for d in items:
            split_str = "; ".join(d.deconstructor_unpack_list)
            decon_batch.append((current_id, d.lookup_key, split_str))
            decon_lookup_batch.append((d.lookup_key, current_id, 0, 0))
            current_id += 1
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
    return decon_batch, decon_lookup_batch