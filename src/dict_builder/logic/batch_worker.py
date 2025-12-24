# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple, Set, Optional
from rich import print

from src.db.db_helpers import get_db_session
# [FIXED] Import thêm model Lookup
from src.db.models import DpdHeadword, Lookup
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_html(html_str: str, compress: bool) -> str | bytes:
    """Xử lý HTML: Nén nếu cần, không thì trả về string gốc."""
    if not html_str:
        return None
    
    if compress:
        return zlib.compress(html_str.encode('utf-8'))
    
    return html_str

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    """
    Worker xử lý Headwords (Entries).
    """
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        for i in headwords:
            # --- Logic Render Entries ---
            if config.is_tiny_mode:
                definition_json = renderer.extract_definition_json(i)
                if config.USE_COMPRESSION:
                    definition_final = zlib.compress(definition_json.encode('utf-8'))
                else:
                    definition_final = definition_json

                entries_data.append((
                    i.id,
                    i.lemma_1,
                    i.lemma_clean,
                    definition_final
                ))
            else:
                grammar_html = renderer.render_grammar(i)
                examples = renderer.render_examples(i)
                definition = renderer.render_entry(i)
                
                entries_data.append((
                    i.id,
                    i.lemma_1,
                    i.lemma_clean,
                    process_html(definition, config.USE_COMPRESSION),
                    process_html(grammar_html, config.USE_COMPRESSION),
                    process_html(examples, config.USE_COMPRESSION)
                ))
            
            # --- Logic Lookups ---
            
            # 1. Headword chính (Luôn thêm)
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            
            # 2. Inflections (Có lọc theo target_set)
            unique_infs = set(i.inflections_list_all)
            
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean:
                    continue
                
                # Nếu đang ở Mini/Tiny mode (target_set not None)
                # thì từ biến thể PHẢI có trong target_set mới được thêm.
                if target_set is not None and inf not in target_set:
                    continue
                    
                lookups_data.append((inf, i.id, 1, 1))
                    
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data

def process_decon_worker(keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    """
    Worker xử lý Deconstructions.
    """
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    decon_batch = []
    decon_lookup_batch = []
    
    current_id = start_id
    
    try:
        # Query theo lookup_key
        # [NOTE] Lookup phải được import ở trên thì dòng này mới chạy được
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        
        for d in items:
            split_str = "; ".join(d.deconstructor_unpack_list)
            
            decon_batch.append((current_id, d.lookup_key, split_str))
            
            # is_headword = 0 (False) -> Trỏ về bảng deconstructions
            decon_lookup_batch.append((d.lookup_key, current_id, 0, 0))
            
            current_id += 1
            
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
        
    return decon_batch, decon_lookup_batch