# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple, Set, Optional
from rich import print

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import DpdHeadword, Lookup
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_data(data_str: str, compress: bool) -> str | bytes:
    if not data_str: return None
    if compress: return zlib.compress(data_str.encode('utf-8'))
    return data_str

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        for i in headwords:
            # 1. Rẽ nhánh xử lý nội dung ENTRY (HTML vs JSON)
            if config.html_mode:
                # --- HTML MODE ---
                if config.is_tiny_mode:
                    definition_html = renderer.render_entry(i)
                    entries_data.append((
                        i.id, i.lemma_1, i.lemma_clean,
                        process_data(definition_html, config.USE_COMPRESSION)
                    ))
                else:
                    grammar_html = renderer.render_grammar(i)
                    examples_html = renderer.render_examples(i)
                    definition_html = renderer.render_entry(i)
                    entries_data.append((
                        i.id, i.lemma_1, i.lemma_clean,
                        process_data(definition_html, config.USE_COMPRESSION),
                        process_data(grammar_html, config.USE_COMPRESSION),
                        process_data(examples_html, config.USE_COMPRESSION)
                    ))
            else:
                # --- JSON MODE ---
                definition_json = renderer.extract_definition_json(i)
                if config.is_tiny_mode:
                    entries_data.append((
                        i.id, i.lemma_1, i.lemma_clean,
                        process_data(definition_json, config.USE_COMPRESSION)
                    ))
                else:
                    grammar_json = renderer.extract_grammar_json(i)
                    example_json = renderer.extract_example_json(i)
                    entries_data.append((
                        i.id, i.lemma_1, i.lemma_clean,
                        process_data(definition_json, config.USE_COMPRESSION),
                        process_data(grammar_json, config.USE_COMPRESSION),
                        process_data(example_json, config.USE_COMPRESSION)
                    ))
            
            # 2. Xử lý LOOKUPS (Dùng chung cho cả 2 mode)
            # Logic này nằm NGOÀI block if/else phía trên -> Chạy giống hệt nhau
            
            # Luôn thêm Headword
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            
            # Xử lý Inflections
            unique_infs = set(i.inflections_list_all)
            
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                
                # [QUAN TRỌNG] Logic lọc Strict Mode
                # Nếu target_set tồn tại (Tiny/Mini) thì PHẢI có trong set mới lấy
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

def process_grammar_notes_worker(keys: List[str], config: BuilderConfig) -> List[tuple]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    grammar_batch = []
    
    try:
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        for item in items:
            grammar_list = item.grammar_unpack_list
            if not grammar_list:
                continue
            
            content_val = None
            
            # Conditional Processing
            if config.html_mode:
                # HTML Mode: Render HTML
                html_str = renderer.render_grammar_notes_html(grammar_list)
                content_val = process_data(html_str, config.USE_COMPRESSION)
            else:
                # JSON Mode: Render JSON
                json_str = renderer.render_grammar_notes_json(grammar_list)
                content_val = process_data(json_str, config.USE_COMPRESSION)
            
            # Return only key and content (schema agnostic here, caller knows mode)
            grammar_batch.append((
                item.lookup_key, 
                content_val
            ))
            
    except Exception as e:
        print(f"[red]Error in grammar notes worker: {e}")
    finally:
        session.close()
        
    return grammar_batch