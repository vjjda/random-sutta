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

GRAMMAR_WEIGHTS = {
    "masc": 1, "nt": 2, "fem": 3,
    "nom": 10, "acc": 11, "instr": 12, "dat": 13, "abl": 14, "gen": 15, "loc": 16, "voc": 17,
    "sg": 20, "pl": 21,
    "3rd": 30, "2nd": 31, "1st": 32,
    "pres": 40, "aor": 41, "fut": 42, "imp": 43, "opt": 44, "cond": 45,
    "part": 50, "inf": 51, "ger": 52, "abs": 53,
    "act": 60, "reflx": 61,
    "pos": 70, "comp": 71, "super": 72,
}

def _grammar_line_sort_key(line: List[str]) -> Tuple:
    weights = [GRAMMAR_WEIGHTS.get(token, 999) for token in line]
    return tuple(weights) + (tuple(line),)

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
        headwords = (
            session.query(DpdHeadword)
            .options(joinedload(DpdHeadword.rt))
            .filter(DpdHeadword.id.in_(ids))
            .all()
        )
        for i in headwords:
            # [CLEANUP] Luôn dùng Logic JSON
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
    # Logic Deconstruction không thay đổi (vẫn trả về chuỗi)
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    decon_batch = []
    # [CLEANUP] Deconstructions no longer need lookups
    decon_lookup_batch = []
    
    try:
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        for d in items:
            split_str = "; ".join(d.deconstructor_unpack_list)
            # Tuple format: (word, components) - No ID needed
            decon_batch.append((d.lookup_key, process_data(split_str, config.USE_COMPRESSION)))
            
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
    
    # Sort by Word (Pali Order)
    decon_batch.sort(key=lambda x: pali_sort_key(x[0]))
    
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
            
            # [CLEANUP] Luôn dùng Logic Grouped JSON Pack
            grammar_list.sort(key=lambda x: (x[0], x[1]))
            packed_data = []
            current_group = None
            current_h = None
            current_p = None
            
            for h, p, gr_str in grammar_list:
                components = gr_str.split()
                if h == current_h and p == current_p:
                    current_group[2].append(components)
                else:
                    current_h = h
                    current_p = p
                    current_group = [h, p, [components]]
                    packed_data.append(current_group)
            
            for group in packed_data:
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
            # [CLEANUP] Luôn dùng JSON
            content = renderer.extract_root_json(r)
            roots_data.append((current_id, r.root, r.root_clean, process_data(content, config.USE_COMPRESSION)))
            clean_key = r.root_clean
            # Type 0 = Roots (Previously 2)
            lookups_data.append((clean_key, current_id, 0))
            current_id += 1
    except Exception as e:
        print(f"[red]Error in roots worker: {e}")
    finally:
        session.close()
    return roots_data, lookups_data

def decon_worker_wrapper(args_tuple: Tuple, config: BuilderConfig) -> Tuple[List, List]:
    keys, start_id = args_tuple
    return process_decon_worker(keys, start_id, config)

def roots_worker_wrapper(args_tuple: Tuple, config: BuilderConfig) -> Tuple[List, List]:
    keys, start_id = args_tuple
    return process_roots_worker(keys, start_id, config)