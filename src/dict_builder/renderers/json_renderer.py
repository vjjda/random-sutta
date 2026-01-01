# Path: src/dict_builder/renderers/json_renderer.py
import json
from src.dict_builder.db.models import DpdHeadword, DpdRoot
from src.dict_builder.tools.meaning_construction import make_grammar_line
from src.dict_builder.tools.json_key_map import JSON_KEY_MAP

class DpdJsonRenderer:
    """
    Chuyên trách việc trích xuất dữ liệu từ SQLAlchemy Models thành định dạng phẳng hoặc JSON.
    """
    
    def _k(self, key: str) -> str:
        """Get abbreviated key from map, or return original if not found."""
        return JSON_KEY_MAP.get(key, key)

    def render_root_definition(self, r: DpdRoot) -> str:
        """Trích xuất Root Definition JSON."""
        data = {
            self._k("pos"): "root",
            self._k("Root"): r.root,
            self._k("meaning"): r.root_meaning,
            self._k("Grammar"): f"Group {r.root_group} {r.root_sign} ({r.root_meaning})"
        }
        
        if r.sanskrit_root:
            data[self._k("Sanskrit Root")] = f"{r.sanskrit_root} {r.sanskrit_root_class} ({r.sanskrit_root_meaning})"
            
        return json.dumps(data, ensure_ascii=False)

    def extract_definition_data(self, i: DpdHeadword) -> dict:
        """
        Trích xuất TOÀN BỘ dữ liệu từ DpdHeadword thành một Dict phẳng.
        Dữ liệu này sẽ được lưu trực tiếp vào các cột của bảng 'entries'.
        """
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        # 1. Base Info
        res = {
            "id": i.id,
            "headword": i.lemma_1,
            "headword_clean": i.lemma_clean,
            "pos": i.pos,
            "meaning": final_meaning,
            "construction": i.construction,
            "degree": i.degree_of_completion,
            "meaning_lit": i.meaning_lit,
            "plus_case": i.plus_case,
            "stem": i.stem,
            "pattern": i.pattern
        }

        # 2. Grammar & Morphology
        res["grammar"] = make_grammar_line(i)
        res["root_family"] = i.family_root if i.family_root else None
        
        if i.root_key and i.rt:
            res["root_info"] = f"{i.root_clean}{i.rt.root_has_verb}{i.rt.root_group} {i.root_sign} ({i.rt.root_meaning})"
            res["root_in_sandhi"] = i.rt.root_in_comps if i.rt.root_in_comps else None
        else:
            res["root_info"] = None
            res["root_in_sandhi"] = None

        res["base"] = i.root_base if i.root_base else None
        
        if i.derivative:
            res["derivative"] = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
        else:
            res["derivative"] = None

        res["phonetic"] = i.phonetic.replace("\n", "<br>") if i.phonetic else None
        
        if i.compound_type and "?" not in i.compound_type:
            res["compound"] = f"{i.compound_type} ({i.compound_construction})"
        else:
            res["compound"] = None

        # 3. Relations
        res["antonym"] = i.antonym if i.antonym else None
        res["synonym"] = i.synonym if i.synonym else None
        res["variant"] = i.variant if i.variant else None

        # 4. Notes & Metadata
        res["commentary"] = i.commentary.replace("\n", "<br>") if (i.commentary and i.commentary != "-") else None
        res["notes"] = i.notes.replace("\n", "<br>") if i.notes else None
        res["cognate"] = i.cognate if i.cognate else None
        res["link"] = i.link if i.link else None
        res["non_ia"] = i.non_ia if i.non_ia else None
        
        # 5. Sanskrit
        res["sanskrit"] = i.sanskrit if i.sanskrit else None
        if i.root_key and i.rt and i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
            res["sanskrit_root"] = f"{i.rt.sanskrit_root} {i.rt.sanskrit_root_class} ({i.rt.sanskrit_root_meaning})"
        else:
            res["sanskrit_root"] = None

        # 6. Examples (Packed format: source|sutta|text)
        def _pack_ex(src, sutta, txt):
            if not txt: return None
            # Standardize: Source and Sutta can be empty but delimiters must exist
            return f"{src if src else ''}|{sutta if sutta else ''}|{txt}"

        res["example_1"] = _pack_ex(i.source_1, i.sutta_1, i.example_1)
        res["example_2"] = _pack_ex(i.source_2, i.sutta_2, i.example_2)

        return res

    # Obsolete methods (kept for reference or temporary compatibility)
    def render_grammar(self, i: DpdHeadword) -> str: return ""
def render_examples(self, i: DpdHeadword) -> str: return ""
def render_grammar_notes(self, grammar_list: list) -> str:
        # Grammar notes table is still used in details expansion
        # We can keep it as is or also flatten later. 
        # For now, let's keep it JSON for the "Grammar Tables" in details.
        return json.dumps(grammar_list, ensure_ascii=False)
