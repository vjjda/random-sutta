# Path: src/dict_builder/tools/pali_sort_key.py
from .pali_alphabet import pali_alphabet

# --- PALI CONFIG ---
pali_letter_to_number = {char: f"{i:02d}" for i, char in enumerate(pali_alphabet)}
PALI_DIGRAPH_STARTS = {"k", "c", "ṭ", "t", "p", "g", "j", "ḍ", "d", "b"} # + 'h' logic

# --- SANSKRIT CONFIG ---
# Ordered Sanskrit Alphabet based on DPD Reference
sanskrit_alphabet = [
    "√", "a", "ā", "i", "ī", "u", "ū", 
    "ṛ", "ṝ", "ḷ", "ḹ", 
    "e", "ai", "o", "au", 
    "ḥ", "ṃ", 
    "k", "kh", "g", "gh", "ṅ", 
    "c", "ch", "j", "jh", "ñ", 
    "ṭ", "ṭh", "ḍ", "ḍh", "ṇ", 
    "t", "th", "d", "dh", "n", 
    "p", "ph", "b", "bh", "m", 
    "y", "r", "l", "v", 
    "ś", "ṣ", "s", "h"
]
sanskrit_letter_to_number = {char: f"{i:02d}" for i, char in enumerate(sanskrit_alphabet)}

# Sanskrit Digraphs include:
# 1. Consonants + 'h' (kh, gh, ch, jh, th, dh, ph, bh...)
# 2. Vowels (ai, au)
SANSKRIT_DIGRAPH_STARTS = {
    "k", "g", "c", "j", "ṭ", "ḍ", "t", "d", "p", "b", # Consonants for +h
    "a" # Vowels for ai, au
}

def _tokenize_word(word: str, letter_map: dict, digraph_starts: set) -> list[str]:
    """
    Generic tokenizer for Indic scripts (Pali/Sanskrit).
    Handles digraphs like 'kh', 'ai' efficiently.
    """
    tokens = []
    i = 0
    n = len(word)
    
    while i < n:
        c = word[i]
        next_c = word[i+1] if i + 1 < n else ""
        
        # Check Digraph Candidate
        # Logic extended: Not just + 'h', but any valid digraph in the map
        if c in digraph_starts:
            candidate = c + next_c
            # Check if this candidate is a valid key in our alphabet map
            if candidate in letter_map:
                tokens.append(candidate)
                i += 2
                continue
        
        # Single char
        tokens.append(c)
        i += 1
        
    return tokens

def _sort_key_generator(word: str, letter_map: dict, digraph_starts: set) -> str:
    if not isinstance(word, str):
        return str(word)
    
    clean_word = word.lower().strip()
    tokens = _tokenize_word(clean_word, letter_map, digraph_starts)
    
    mapped_tokens = []
    for t in tokens:
        val = letter_map.get(t)
        if val:
            mapped_tokens.append(val)
        else:
            mapped_tokens.append(t)
            
    return "".join(mapped_tokens)

def pali_sort_key(word: str) -> str:
    """Sort key for Pali words."""
    return _sort_key_generator(word, pali_letter_to_number, PALI_DIGRAPH_STARTS)

def sanskrit_sort_key(word: str) -> str:
    """Sort key for Sanskrit words."""
    return _sort_key_generator(word, sanskrit_letter_to_number, SANSKRIT_DIGRAPH_STARTS)
