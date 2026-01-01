from typing import List, Tuple, Dict
import json

# --- CONSTANTS ---
GRAMMAR_WEIGHTS = {
    # Gender (1-9)
    "masc": 1, "nt": 2, "neut": 2, "fem": 3, "x": 4, "dual": 5,
    
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

# --- HELPERS ---

def _inflection_str_sort_key(info_str: str) -> Tuple:
    """Sort key for inflection strings (e.g. 'masc nom sg') using GRAMMAR_WEIGHTS."""
    tokens = info_str.split()
    weights = [GRAMMAR_WEIGHTS.get(token, 999) for token in tokens]
    return tuple(weights) + (info_str,)

def generate_inflection_map(stem: str, template_data: List) -> dict:
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

def group_inflection_items(items: List[str]) -> List[str]:
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
        if k == "other":
            # Omit 'other|' prefix for standalone items like "in comps"
            packed_str = "|".join(grouped_map[k])
        else:
            # Join GroupKey and all Items with '|'
            packed_str = "|".join([k] + grouped_map[k])
        
        if packed_str:
            result.append(packed_str)
        
    return result
