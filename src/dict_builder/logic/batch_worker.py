# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword, Lookup
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_html(html_str: str, compress: bool) -> str | bytes:
    if not html_str: return None
    if compress: return zlib.compress(html_str.encode('utf-8'))
    return html_str

# --- Worker cho Entries (Giữ nguyên) ---
def process_batch_worker(ids: List[int], config: BuilderConfig) -> Tuple[List, List]:
    # ... (Giữ nguyên code cũ của hàm này) ...
    # Copy lại code cũ của process_batch_worker ở đây
    # Lưu ý: Tôi không paste lại để tiết kiệm không gian, hãy giữ nguyên hàm này
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    entries_data = []
    lookups_data = []
    try:
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        for i in headwords:
            if config.is_tiny_mode:
                definition_json = renderer.extract_definition_json(i)
                if config.USE_COMPRESSION:
                    definition_final = zlib.compress(definition_json.encode('utf-8'))
                else:
                    definition_final = definition_json
                entries_data.append((i.id, i.lemma_1, i.lemma_clean, definition_final))
            else:
                grammar_html = renderer.render_grammar(i)
                examples = renderer.render_examples(i)
                definition = renderer.render_entry(i)
                entries_data.append((
                    i.id, i.lemma_1, i.lemma_clean,
                    process_html(definition, config.USE_COMPRESSION),
                    process_html(grammar_html, config.USE_COMPRESSION),
                    process_html(examples, config.USE_COMPRESSION)
                ))
            
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            unique_infs = set(i.inflections_list_all)
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                lookups_data.append((inf, i.id, 1, 1))
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
    return entries_data, lookups_data

# --- [NEW] Worker cho Deconstructions ---
def process_decon_worker(keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    """
    Xử lý song song cho Deconstructions.
    keys: Danh sách lookup_key cần xử lý.
    start_id: ID bắt đầu cho batch này (để giả lập Auto Increment).
    """
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    decon_batch = []
    decon_lookup_batch = []
    
    current_id = start_id
    
    try:
        # Query theo lookup_key (vì bảng Lookup dùng key làm PK)
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        
        # Sort lại để đảm bảo thứ tự ID nhất quán (nếu cần)
        # items.sort(key=lambda x: x.lookup_key) 
        
        for d in items:
            # Render HTML hoặc JSON tùy mode (Hiện tại Decon dùng chung logic render_deconstruction HTML)
            # Nếu muốn tối ưu cho tiny, có thể chỉ lưu split string
            
            # Logic: Tiny hay Mini đều lưu split string
            split_str = "; ".join(d.deconstructor_unpack_list)
            
            decon_batch.append((current_id, d.lookup_key, split_str))
            decon_lookup_batch.append((d.lookup_key, current_id, 0, 0))
            
            current_id += 1
            
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
        
    return decon_batch, decon_lookup_batch