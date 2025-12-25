# Path: src/dict_builder/logic/batch_worker.py
import zlib
from typing import List, Tuple, Set, Optional
from sqlalchemy.orm import joinedload

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import DpdHeadword, Lookup, DpdRoot
from ..entry_renderer import DpdRenderer
from ..builder_config import BuilderConfig
from src.dict_builder.tools.pali_sort_key import pali_sort_key

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
        # Optimize: Eager load 'rt' (Root) as it's used in grammar rendering
        headwords = (
            session.query(DpdHeadword)
            .options(joinedload(DpdHeadword.rt))
            .filter(DpdHeadword.id.in_(ids))
            .all()
        )
        
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
            
            # 2. Xử lý LOOKUPS (Type=1 for Entries)
            
            # Luôn thêm Headword
            lookups_data.append((i.lemma_clean, i.id, 1))
            
            # Xử lý Inflections
            unique_infs = set(i.inflections_list_all)
            
            for inf in unique_infs:
                if not inf or inf == i.lemma_clean: continue
                
                # [QUAN TRỌNG] Logic lọc Strict Mode
                # Nếu target_set tồn tại (Tiny/Mini) thì PHẢI có trong set mới lấy
                if target_set is not None and inf not in target_set:
                    continue
                    
                lookups_data.append((inf, i.id, 1))
                    
    except Exception as e:
        print(f"[red]Error in entries worker: {e}")
    finally:
        session.close()
    
    # Sort results to maintain Pali order within batch
    entries_data.sort(key=lambda x: pali_sort_key(x[1])) # x[1] is headword
    lookups_data.sort(key=lambda x: pali_sort_key(x[0])) # x[0] is key
        
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
            
            # Type=0 for Deconstructions
            decon_lookup_batch.append((d.lookup_key, current_id, 0))
            current_id += 1
    except Exception as e:
        print(f"[red]Error in decon worker: {e}")
    finally:
        session.close()
    
    # Sort decon results
    decon_batch.sort(key=lambda x: pali_sort_key(x[1])) # x[1] is word (lookup_key)
    decon_lookup_batch.sort(key=lambda x: pali_sort_key(x[0])) # x[0] is key
    
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
    
    # Sort grammar results
    grammar_batch.sort(key=lambda x: pali_sort_key(x[0])) # x[0] is key
        
    return grammar_batch

def process_roots_worker(root_keys: List[str], start_id: int, config: BuilderConfig) -> Tuple[List, List]:
    """
    Worker to process roots.
    Returns: (roots_data, lookups_data)
    """
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    roots_data = []
    lookups_data = []
    current_id = start_id
    
    try:
        # Fetch DpdRoot objects by root name (PK)
        roots = session.query(DpdRoot).filter(DpdRoot.root.in_(root_keys)).all()
        
        for r in roots:
            # Render content
            if config.html_mode:
                # For now, assume render_root_definition generates HTML-friendly JSON or HTML string?
                # Actually, DpdJsonRenderer has render_root_definition returning JSON string.
                # If we need HTML root view, we need a template.
                # For now, let's reuse JSON content or implement HTML renderer for roots.
                # User asked for self-contained lookup.
                # Let's stick to whatever render_root_definition returns.
                # Wait, renderer.render_root_definition is in JSON Renderer.
                # We need to expose it in DpdRenderer facade.
                
                # Use extract_root_json via facade (to be added)
                # Or assume we want JSON content even in HTML db? 
                # Grand view selects `r.definition_{suffix}`.
                # If HTML mode, suffix is 'html'.
                # We need HTML content.
                # Currently I only implemented JSON renderer for roots.
                # Fallback: wrap JSON in basic HTML or just use JSON string (client handles it).
                # Better: Implement proper HTML renderer.
                
                # For this step, I'll assume we use JSON string for now or a placeholder HTML.
                # Let's assume Facade has `render_root_entry(r)` -> string.
                content = renderer.render_root_entry(r)
            else:
                content = renderer.extract_root_json(r)
            
            roots_data.append((
                current_id,
                r.root,
                process_data(content, config.USE_COMPRESSION)
            ))
            
            # Lookup: Use CLEAN root (without number) for user search
            # Example: √yat 1 -> √yat, √yat 2 -> √yat
            # This allows user to find all variants by typing "√yat"
            clean_key = r.root_clean
            lookups_data.append((clean_key, current_id, 2))
                 
            current_id += 1
            
    except Exception as e:
        print(f"[red]Error in roots worker: {e}")
    finally:
        session.close()
        
    return roots_data, lookups_data
