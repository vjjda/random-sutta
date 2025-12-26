# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple, Set, Optional
from sqlalchemy.orm import joinedload

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import DpdHeadword, Lookup, DpdRoot
from ..entry_renderer import DpdRenderer
from ..builder_config import BuilderConfig
from src.dict_builder.tools.pali_sort_key import pali_sort_key

# ... [Giữ nguyên các hàm process_data, process_batch_worker, process_decon_worker cũ] ...

def process_data(data_str: str, compress: bool) -> str | bytes:
    if not data_str: return None
    if compress: return zlib.compress(data_str.encode('utf-8'))
    return data_str

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    # ... [Code cũ giữ nguyên] ...
    # (Để tiết kiệm không gian hiển thị, tôi không paste lại toàn bộ logic cũ ở đây,
    #  chỉ paste lại nếu bạn cần. Giả định logic cũ vẫn nằm ở đây)
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    entries_data = []
    lookups_data = []
    try:
        headwords = (
            session.query(DpdHeadword)
            .options(joinedload(DpdHeadword.rt))
            .filter(DpdHeadword.id.in_(ids))
            .all()
        )
        for i in headwords:
            if config.html_mode:
                if config.is_tiny_mode:
                    definition_html = renderer.render_entry(i)
                    entries_data.append((i.id, i.lemma_1, i.lemma_clean, process_data(definition_html, config.USE_COMPRESSION)))
                else:
                    grammar_html = renderer.render_grammar(i)
                    examples_html = renderer.render_examples(i)
                    definition_html = renderer.render_entry(i)
                    entries_data.append((i.id, i.lemma_1, i.lemma_clean, process_data(definition_html, config.USE_COMPRESSION), process_data(grammar_html, config.USE_COMPRESSION), process_data(examples_html, config.USE_COMPRESSION)))
            else:
                definition_json = renderer.extract_definition_json(i)
                if config.is_tiny_mode:
                    entries_data.append((i.id, i.lemma_1, i.lemma_clean, process_data(definition_json, config.USE_COMPRESSION)))
                else:
                    grammar_json = renderer.extract_grammar_json(i)
                    example_json = renderer.extract_example_json(i)
                    entries_data.append((i.id, i.lemma_1, i.lemma_clean, process_data(definition_json, config.USE_COMPRESSION), process_data(grammar_json, config.USE_COMPRESSION), process_data(example_json, config.USE_COMPRESSION)))
            lookups_data.append((i.lemma_clean, i.id, 1))
            unique_infs = set(i.inflections_list_all)
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                if target_set is not None and inf not in target_set: continue
                lookups_data.append((inf, i.id, 1))
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
    entries_data.sort(key=lambda x: pali_sort_key(x[1]))
    lookups_data.sort(key=lambda x: pali_sort_key(x[0]))
    return entries_data, lookups_data

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
            decon_batch.append((current_id, d.lookup_key, process_data(split_str, config.USE_COMPRESSION)))
            decon_lookup_batch.append((d.lookup_key, current_id, 0))
            current_id += 1
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
    decon_batch.sort(key=lambda x: pali_sort_key(x[1]))
    decon_lookup_batch.sort(key=lambda x: pali_sort_key(x[0]))
    return decon_batch, decon_lookup_batch

def process_grammar_notes_worker(keys: List[str], config: BuilderConfig) -> List[tuple]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    grammar_batch = []
    try:
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        for item in items:
            grammar_list = item.grammar_unpack_list
            if not grammar_list: continue
            content_val = None
            if config.html_mode:
                html_str = renderer.render_grammar_notes_html(grammar_list)
                content_val = process_data(html_str, config.USE_COMPRESSION)
            else:
                json_str = renderer.render_grammar_notes_json(grammar_list)
                content_val = process_data(json_str, config.USE_COMPRESSION)
            grammar_batch.append((item.lookup_key, content_val))
    except Exception as e:
        print(f"[red]Error in grammar notes worker: {e}")
    finally:
        session.close()
    grammar_batch.sort(key=lambda x: pali_sort_key(x[0]))
    return grammar_batch

def process_roots_worker(root_keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    roots_data = []
    lookups_data = []
    current_id = start_id
    try:
        roots = session.query(DpdRoot).filter(DpdRoot.root.in_(root_keys)).all()
        for r in roots:
            if config.html_mode:
                content = renderer.render_root_entry(r)
            else:
                content = renderer.extract_root_json(r)
            roots_data.append((current_id, r.root, r.root_clean, process_data(content, config.USE_COMPRESSION)))
            clean_key = r.root_clean
            lookups_data.append((clean_key, current_id, 2))
            current_id += 1
    except Exception as e:
        print(f"[red]Error in roots worker: {e}")
    finally:
        session.close()
    return roots_data, lookups_data

# --- [MOVED] Wrappers for Multiprocessing ---

def decon_worker_wrapper(args_tuple: Tuple, config: BuilderConfig) -> Tuple[List, List]:
    keys, start_id = args_tuple
    return process_decon_worker(keys, start_id, config)

def roots_worker_wrapper(args_tuple: Tuple, config: BuilderConfig) -> Tuple[List, List]:
    keys, start_id = args_tuple
    return process_roots_worker(keys, start_id, config)