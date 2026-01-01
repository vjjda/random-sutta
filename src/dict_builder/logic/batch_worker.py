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
from .inflection_manager import generate_inflection_map, group_inflection_items

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
            .options(joinedload(DpdHeadword.rt), joinedload(DpdHeadword.it)) 
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
                i.stem,
                i.pattern,
                process_data(grammar_json, config.USE_COMPRESSION), 
                process_data(example_json, config.USE_COMPRESSION)
            ))
            
            # [UPDATE] Inflection Map Generation
            inflection_map = {}
            if i.it and i.stem:
                 inflection_map = generate_inflection_map(i.stem, i.it.inflection_template_unpack)

            # Headword Lookup
            headword_map = inflection_map.get(i.lemma_clean)
            if headword_map:
                headword_grouped = group_inflection_items(headword_map)
                headword_json = json.dumps(headword_grouped, ensure_ascii=False)
            else:
                headword_json = None
            
            # [SCHEMA UPDATE] Tuple Order: (key, type, target_id, map)
            lookups_data.append((i.lemma_clean, 1, i.id, headword_json))
            
            unique_infs = set(i.inflections_list_all)
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                if target_set is not None and inf not in target_set: continue
                
                # Get map for this form
                form_map = inflection_map.get(inf)
                if form_map:
                    form_grouped = group_inflection_items(form_map)
                    form_json = json.dumps(form_grouped, ensure_ascii=False)
                else:
                    form_json = None
                
                # [SCHEMA UPDATE] Tuple Order: (key, type, target_id, map)
                lookups_data.append((inf, 1, i.id, form_json))
                
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
    entries_data.sort(key=lambda x: pali_sort_key(x[1]))
    lookups_data.sort(key=lambda x: pali_sort_key(x[0]))
    return entries_data, lookups_data

def process_decon_worker(keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    # Logic Deconstruction
    session = get_db_session(config.DPD_DB_PATH)
    decon_batch = []
    decon_lookup_batch = []
    
    try:
        items = session.query(Lookup).filter(Lookup.lookup_key.in_(keys)).all()
        for d in items:
            # [REFACTOR] Convert to CSV-like String: "part1+part2,part3+part4"
            raw_list = d.deconstructor_unpack_list 
            processed_items = []
            
            if raw_list:
                for item in raw_list:
                    # Remove spaces around the plus sign
                    parts = [p.strip() for p in item.split("+")]
                    processed_items.append("+".join(parts))
            
            # Join variants with comma
            csv_str = ",".join(processed_items)
            
            # Tuple format: (word, components_string)
            decon_batch.append((d.lookup_key, process_data(csv_str, config.USE_COMPRESSION)))
            
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
    
    # Sort by Word (Pali Order)
    decon_batch.sort(key=lambda x: pali_sort_key(x[0]))
    
    return decon_batch, decon_lookup_batch

def process_roots_worker(root_keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    session = get_db_session(config.DPD_DB_PATH)
    roots_data = []
    lookups_data = []
    current_id = start_id
    try:
        roots = session.query(DpdRoot).filter(DpdRoot.root.in_(root_keys)).all()
        for r in roots:
            clean_key = r.root_clean        # "√gam"

            # Roots Data
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
            
            # [SCHEMA UPDATE] Lookups (Type 0 = Roots)
            # Tuple Order: (key, type, target_id, map=None)
            # Note: _insert_lookups checks dimensionality. 
            # If 3 items -> (key, target_id, type) (Old logic) -> We must ensure it matches new logic
            # Let's standardize to 4 items or update inserter logic.
            # For consistency with new schema: (clean_key, 0, current_id)
            # But the table definition has 4 columns. 
            # We should provide 3 items and rely on Inserter to handle column mapping? 
            # Or provide 4 with None?
            # Schema: key, target_id, type, inflection_map (OLD) -> (key, type, target_id, inflection_map) (NEW)
            
            # Let's check DataInserter logic again.
            # Ideally, provide 3 items: (key, 0, current_id)
            # And modify Inserter to map correctly.
            lookups_data.append((clean_key, 0, current_id))
            
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
