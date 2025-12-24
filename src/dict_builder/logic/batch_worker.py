# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword
from ..renderer import DpdRenderer
from ..config import BuilderConfig

def process_html(html_str: str, compress: bool) -> str | bytes:
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
            # --- Logic render entries (Giữ nguyên) ---
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
            
            # --- [UPDATED] Logic Lookups: Chống trùng lặp ---
            
            # 1. Luôn thêm Headword chính (Ưu tiên cao nhất)
            lookups_data.append((i.lemma_clean, i.id, 1, 0))
            
            # 2. Thêm các biến thể (Inflections)
            # Dùng set() để loại bỏ trùng lặp nội bộ trong list inflections trước
            unique_infs = set(i.inflections_list_all)
            
            for inf in unique_infs:
                # [FIX] Nếu inflection trùng với headword -> Bỏ qua (vì đã add ở bước 1 rồi)
                if not inf or inf == i.lemma_clean:
                    continue
                    
                lookups_data.append((inf, i.id, 1, 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data