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
    # Gender (1-9)
    "masc": 1, "nt": 2, "neut": 2, "fem": 3, "x": 4, 
    
    # Case (10-19)
    "nom": 10, "acc": 11, "instr": 12, "dat": 13, "abl": 14, "gen": 15, "loc": 16, "voc": 17,
    
    # Number (20-29)
    "sg": 20, "pl": 21,
    
    # Person (30-39)
    "3rd": 30, "2nd": 31, "1st": 32,
    
    # Tense/Mood (40-49)
    "pr": 40, "pres": 40, "imp": 41, "opt": 42, "cond": 43, "fut": 44, 
    "aor": 45, "imperf": 46, "perf": 47,
    
    # Verb Forms (50-59)
    "pp": 50, "ppr": 51, "fpp": 52, "grd": 52, "ptp": 52, 
    "abs": 53, "ger": 53, "inf": 54, "part": 55,
    
    # Voice/Derivation (60-69)
    "act": 60, "reflx": 61, "pass": 62, "caus": 63, "denom": 64,
    
    # Degree (70-79)
    "pos": 70, "comp": 71, "super": 72,
    
    # Part of Speech (80-89)
    "adj": 80, "pron": 81, "card": 82, "ord": 83, "adv": 84, "prep": 85,
}

def _grammar_line_sort_key(line: List[str]) -> Tuple:
    weights = [GRAMMAR_WEIGHTS.get(token, 999) for token in line]
    return tuple(weights) + (tuple(line),)

def _inflection_str_sort_key(info_str: str) -> Tuple:
    """Sort key for inflection strings (e.g. 'masc nom sg') using GRAMMAR_WEIGHTS."""
    tokens = info_str.split()
    weights = [GRAMMAR_WEIGHTS.get(token, 999) for token in tokens]
    return tuple(weights) + (info_str,)

def _group_inflection_items(items: List[str]) -> List[str]:
    """
    Groups a flat list of inflection strings into a structured format for the frontend.
    Returns a list of packed strings to save space.
    Format: "GroupKey|Main~Count|Main~Count"
    - '|' separates GroupKey from items, and items from each other.
    - '~' separates Main from Count (if Count exists).
    """
    if not items: return []
    
    # Priority Groups (dual is treated as a gender-like group)
    GROUPS = {
        "gender": {'masc', 'nt', 'neut', 'fem', 'x', 'dual'},
        "person": {'1st', '2nd', '3rd'},
    }
    
    grouped_map = {} # Key: GroupName, Value: List of string (formatted as "Main~Count" or "Main")
    
    for item in items:
        tokens = item.split()
        group_key = "other"
        token_set = set(t.lower() for t in tokens)
        
        # 1. Determine Group Key
        found_gender = token_set.intersection(GROUPS["gender"])
        if found_gender:
            group_key = list(found_gender)[0]
        else:
            found_person = token_set.intersection(GROUPS["person"])
            if found_person:
                group_key = list(found_person)[0]
        
        # 2. Extract Content (Main & Count)
        if group_key != "other":
            content_tokens = [t for t in tokens if t.lower() != group_key]
        else:
            content_tokens = tokens
            
        if not content_tokens:
            main_part = ""
            count_part = None
        else:
            last_token = content_tokens[-1]
            if last_token.lower() in ['sg', 'pl']:
                count_part = last_token
                main_part = " ".join(content_tokens[:-1])
            else:
                count_part = None
                main_part = " ".join(content_tokens)
        
        # Format the item string
        if count_part:
            formatted_item = f"{main_part}~{count_part}"
        else:
            formatted_item = main_part

        if group_key not in grouped_map:
            grouped_map[group_key] = []
        grouped_map[group_key].append(formatted_item)

    # 3. Sort and Build Packed Strings
    sort_order = ["masc", "nt", "neut", "fem", "x", "dual", "1st", "2nd", "3rd", "other"]
    present_keys = sorted(grouped_map.keys(), key=lambda k: sort_order.index(k) if k in sort_order else 999)
    
    result = []
    for k in present_keys:
        # Join GroupKey and all Items with '|'
        # e.g. "masc|nom~sg|acc~pl"
        packed_str = "|".join([k] + grouped_map[k])
        result.append(packed_str)
        
    return result

def process_data(data_str: str, compress: bool) -> str | bytes:
    if not data_str: return None
    if compress: return zlib.compress(data_str.encode('utf-8'))
    return data_str

def _generate_inflection_map(stem: str, template_data: List) -> dict:
    """
    Generate a map of inflection forms to their grammatical descriptions.
    Returns: Dict[form_str, List[grammatical_descriptions]]
    """
    # Exclude non-inflected stems (starts with "-"), but ALLOW "*" and "!"
    if not stem or not template_data or stem.startswith("-"):
        return {}
    
    # Handle Exclamation Stem (Remove "!")
    clean_stem = stem
    if stem.startswith("!"):
        clean_stem = stem[1:]
    
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
                    # [UPDATE] Irregular Stem Logic
                    if stem == "*":
                        form = sfx # In irregular templates, suffix is the full form
                    else:
                        form = f"{clean_stem}{sfx}" if sfx else clean_stem
                        
                    if not form: continue
                    
                    if form not in inf_map:
                        inf_map[form] = set()
                    inf_map[form].add(meta_desc)
                    
    except Exception:
        pass
        
    # Convert sets to sorted lists using grammatical weights
    return {k: sorted(list(v), key=_inflection_str_sort_key) for k, v in inf_map.items()}

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
                i.stem, # [NEW]
                i.pattern, # [NEW]
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
            if headword_map:
                headword_grouped = _group_inflection_items(headword_map)
                headword_json = json.dumps(headword_grouped, ensure_ascii=False)
            else:
                headword_json = None
            lookups_data.append((i.lemma_clean, i.id, 1, headword_json))
            
            unique_infs = set(i.inflections_list_all)
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                if target_set is not None and inf not in target_set: continue
                
                # Get map for this form
                form_map = inflection_map.get(inf)
                if form_map:
                    form_grouped = _group_inflection_items(form_map)
                    form_json = json.dumps(form_grouped, ensure_ascii=False)
                else:
                    form_json = None
                
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