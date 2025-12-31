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

def _generate_inflection_map(stem: str, template_data: List) -> dict:
    """
    Generate a map of inflection forms to their grammatical descriptions.
    Returns: Dict[form_str, List[grammatical_descriptions]]
    """
    if not stem or not template_data or stem.startswith("!") or stem.startswith("-"):
        return {}
    
    inf_map = {} # Dict[form, Set[meta]]
    
    try:
        # Skip header row (index 0)
        for row in template_data[1:]:
            if not row: continue
            
            # Row structure: [Label, [Suf1], [Meta1], [Suf2], [Meta2], ...]
            # Start from index 1, step 2 to get Suffixes. Metadata is at i+1.
            for i in range(1, len(row), 2):
                if i+1 >= len(row): break 
                
                suffixes = row[i]
                metadata = row[i+1] # List of strings e.g. ["masc nom sg"]
                
                meta_desc = metadata[0] if metadata else ""
                if not meta_desc: continue

                for sfx in suffixes:
                    form = f"{stem}{sfx}" if sfx else stem
                    if form not in inf_map:
                        inf_map[form] = set()
                    inf_map[form].add(meta_desc)
                    
    except Exception:
        pass
        
    # Convert sets to sorted lists
    return {k: sorted(list(v)) for k, v in inf_map.items()}

def process_batch_worker(ids: List[int], config: BuilderConfig, target_set: Optional[Set[str]]) -> Tuple[List, List]:
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    entries_data = []
    lookups_data = []
    try:
        headwords = (
            session.query(DpdHeadword)
            .options(joinedload(DpdHeadword.rt), joinedload(DpdHeadword.it)) # [UPDATE] Load InflectionTemplates
            .filter(DpdHeadword.id.in_(ids))
            .all()
        )
        for i in headwords:
            # [REFACTOR] Extract data columns instead of JSON
            def_data = renderer.extract_definition_data(i)
            
            grammar_json = renderer.extract_grammar_json(i) if not config.is_tiny_mode else None
            example_json = renderer.extract_example_json(i) if not config.is_tiny_mode else None
            
            # Prepare Tuple for Insert
            entries_data.append((
                i.id, 
                i.lemma_1, 
                i.lemma_clean,
                def_data["pos"],
                def_data["meaning"],
                def_data["construction"],
                def_data["degree"],
                def_data["meaning_lit"],
                def_data["plus_case"],
                process_data(grammar_json, config.USE_COMPRESSION), 
                process_data(example_json, config.USE_COMPRESSION)
            ))
            
            # [UPDATE] Inflection Map Generation
            inflection_map = {}
            if i.it and i.stem:
                 inflection_map = _generate_inflection_map(i.stem, i.it.inflection_template_unpack)

            # Headword Lookup
            # Check if headword itself has mapping (e.g. nom sg)
            headword_map = inflection_map.get(i.lemma_clean)
            headword_json = json.dumps(headword_map, ensure_ascii=False) if headword_map else None
            lookups_data.append((i.lemma_clean, i.id, 1, headword_json))
            
            unique_infs = set(i.inflections_list_all)
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                if target_set is not None and inf not in target_set: continue
                
                # Get map for this form
                form_map = inflection_map.get(inf)
                form_json = json.dumps(form_map, ensure_ascii=False) if form_map else None
                
                lookups_data.append((inf, i.id, 1, form_json))
                
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
            # [REFACTOR] Convert to JSON Array of Arrays: [["part1", "part2"], ["part3", "part4"]]
            raw_list = d.deconstructor_unpack_list # ["a + b", "c + d"]
            processed_list = []
            for item in raw_list:
                # Split by "+" and strip whitespace
                parts = [p.strip() for p in item.split("+")]
                processed_list.append(parts)
            
            json_str = json.dumps(processed_list, ensure_ascii=False, separators=(',', ':'))
            
            # Tuple format: (word, components_json)
            decon_batch.append((d.lookup_key, process_data(json_str, config.USE_COMPRESSION)))
            
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
            grammar_list.sort(key=lambda x: (len(x[0]), pali_sort_key(x[0]), x[1]))
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
            # [REFACTOR] Extract physical columns instead of JSON
            
            # 3. Keys
            clean_key = r.root_clean        # "√gam"

            # 4. Append Data (Schema: id, root, root_clean, meaning, group, sign, sk_root, sk_class, sk_meaning)
            roots_data.append((
                current_id, 
                r.root, 
                clean_key, 
                r.root_meaning, 
                r.root_group,
                r.root_sign,
                r.sanskrit_root,
                r.sanskrit_root_class,
                r.sanskrit_root_meaning
            ))
            
            # 5. Lookups (Type 0 = Roots)
            # Add clean key (√gam)
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