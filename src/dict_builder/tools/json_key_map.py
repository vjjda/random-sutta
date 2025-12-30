# Path: src/dict_builder/tools/json_key_map.py

# Mapping: Full Key -> Abbreviated Key
# Based on src/dict_builder/renderers/json_renderer.py

JSON_KEY_MAP = {
    # --- Grammar ---
    "Grammar": "g",
    "Root Family": "rf",
    "Root": "r",
    "√ In Sandhi": "rs",
    "Base": "b",
    "Construction": "cf", # construction full
    "Derivative": "dr",
    "Phonetic Change": "ph",
    "Compound": "cp",
    "Antonym": "ant",
    "Synonym": "syn",
    "Variant": "var",
    "Commentary": "cm",
    "Notes": "n",
    "English Cognate": "ec",
    "Web Link": "wl",
    "Non IA": "nia",
    "Sanskrit": "sk",
    "Sanskrit Root": "skr",

    # --- Examples ---
    "source": "src",
    "sutta": "st",
    "text": "txt",

    # --- Grammar Notes (Obsolete keys removed) ---
}

def get_key_map_list() -> list[tuple]:
    """Returns a list of tuples (full_key, abbr_key) for database insertion."""
    return [(k, v) for k, v in JSON_KEY_MAP.items()]
