# Path: src/dict_builder/logic/batch_worker.py
import zlib
import json
from typing import List, Tuple, Set, Optional
from sqlalchemy.orm import joinedload

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import DpdHeadword, Lookup, DpdRoot
from ..entry_renderer import DpdRenderer
from ..builder_config import BuilderConfig
from src.dict_builder.tools.pali_sort_key import pali_sort_key

# [CONFIG] Grammar Sorting Weights (Lower = Appear First)
GRAMMAR_WEIGHTS = {
    # Gender
    "masc": 1, "nt": 2, "fem": 3,
    
    # Case (Standard Pali Order)
    "nom": 10, "acc": 11, "instr": 12, "dat": 13, "abl": 14, "gen": 15, "loc": 16, "voc": 17,
    
    # Number
    "sg": 20, "pl": 21,
    
    # Person
    "3rd": 30, "2nd": 31, "1st": 32,
    
    # Verb Tenses/Modes (Frequency based)
    "pres": 40, "aor": 41, "fut": 42, "imp": 43, "opt": 44, "cond": 45,
    "part": 50, "inf": 51, "ger": 52, "abs": 53,
    
    # Voice
    "act": 60, "reflx": 61,
    
    # Degrees
    "pos": 70, "comp": 71, "super": 72,
}

def _grammar_line_sort_key(line: List[str]) -> Tuple:
    """
    Generates a sort key for a grammar line (list of tokens).
    Format: (weight_token_1, weight_token_2, ..., original_string_for_tiebreak)
    """
    weights = [GRAMMAR_WEIGHTS.get(token, 999) for token in line]
    return tuple(weights) + (tuple(line),)

# ... [Giữ nguyên các hàm process_data, process_batch_worker, process_decon_worker cũ] ...

def process_data(data_str: str, compress: bool) -> str | bytes:
    if not data_str: return None
    if compress: return zlib.compress(data_str.encode('utf-8'))
    return data_str

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    # ... [Keep existing implementation] ...
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
                # [OPTIMIZED] Grouped Grammar Pack Strategy
                # Input grammar_list: [(h1, p1, gr1), (h1, p1, gr2), (h2, p2, gr3)...]
                
                # 1. Sort by Headword then POS for grouping
                grammar_list.sort(key=lambda x: (x[0], x[1]))
                
                packed_data = []
                current_group = None
                current_h = None
                current_p = None
                
                for h, p, gr_str in grammar_list:
                    # Parse grammar string into components array
                    # Example: "masc nom sg" -> ["masc", "nom", "sg"]
                    components = gr_str.split()
                    
                    if h == current_h and p == current_p:
                        current_group[2].append(components)
                    else:
                        current_h = h
                        current_p = p
                        current_group = [h, p, [components]]
                        packed_data.append(current_group)
                
                # [NEW] Sort the lines within each group for nice display
                for group in packed_data:
                    # group[2] is the list of grammar lines
                    group[2].sort(key=_grammar_line_sort_key)

                json_str = json.dumps(packed_data, ensure_ascii=False, separators=(',', ':'))
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