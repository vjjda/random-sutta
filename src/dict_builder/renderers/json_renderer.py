# Path: src/dict_builder/renderers/json_renderer.py
import json
from src.dict_builder.db.models import DpdHeadword, DpdRoot
from src.dict_builder.tools.meaning_construction import make_grammar_line
from src.dict_builder.tools.json_key_map import JSON_KEY_MAP

class DpdJsonRenderer:
    """
    Chuyên trách việc trích xuất dữ liệu và format thành JSON.
    Dùng cho các mode mặc định (Tiny, Mini, Full).
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

    def render_definition(self, i: DpdHeadword) -> str:
        """Trích xuất Definition JSON."""
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        data = {
            self._k("pos"): i.pos,
            self._k("meaning"): final_meaning
        }
        
        if i.meaning_lit: data[self._k("meaning_lit")] = i.meaning_lit
        if i.plus_case: data[self._k("plus_case")] = i.plus_case
        if i.construction_summary: data[self._k("construction")] = i.construction_summary
        if i.degree_of_completion: data[self._k("degree")] = i.degree_of_completion
        
        # [MOVED] Commentary removed from here to render_grammar
            
        return json.dumps(data, ensure_ascii=False)

    def render_grammar(self, i: DpdHeadword) -> str:
        """Trích xuất Grammar JSON."""
        if not i.meaning_1:
            return ""

        data = {}

        # 1. Grammar Summary
        grammar_line = make_grammar_line(i)
        if grammar_line: data[self._k("Grammar")] = grammar_line
        
        # 2. Root Family
        if i.family_root: data[self._k("Root Family")] = i.family_root

        # 3. Root Details
        if i.root_key and i.rt:
            root_str = f"{i.root_clean}{i.rt.root_has_verb}{i.rt.root_group} {i.root_sign} ({i.rt.root_meaning})"
            data[self._k("Root")] = root_str
            if i.rt.root_in_comps: data[self._k("√ In Sandhi")] = i.rt.root_in_comps

        # 4. Construction & Morphology
        if i.root_base: data[self._k("Base")] = i.root_base
        if i.construction: data[self._k("Construction")] = i.construction.replace("\n", "<br>")
        
        if i.derivative:
            val = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
            data[self._k("Derivative")] = val

        if i.phonetic: data[self._k("Phonetic Change")] = i.phonetic.replace("\n", "<br>")
        
        if i.compound_type and "?" not in i.compound_type:
            val = f"{i.compound_type} ({i.compound_construction})"
            data[self._k("Compound")] = val

        # 5. Relations
        if i.antonym: data[self._k("Antonym")] = i.antonym
        if i.synonym: data[self._k("Synonym")] = i.synonym
        if i.variant: data[self._k("Variant")] = i.variant

        # 6. Notes & Metadata
        # [MOVED] Commentary logic moved here
        if i.commentary and i.commentary != "-": 
            data[self._k("Commentary")] = i.commentary.replace("\n", "<br>")

        if i.notes: data[self._k("Notes")] = i.notes.replace("\n", "<br>")
        if i.cognate: data[self._k("English Cognate")] = i.cognate
        if i.link: data[self._k("Web Link")] = i.link 
        if i.non_ia: data[self._k("Non IA")] = i.non_ia
        
        # 7. Sanskrit
        if i.sanskrit: data[self._k("Sanskrit")] = i.sanskrit

        if i.root_key and i.rt and i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
            ss_str = f"{i.rt.sanskrit_root} {i.rt.sanskrit_root_class} ({i.rt.sanskrit_root_meaning})"
            data[self._k("Sanskrit Root")] = ss_str

        if not data: return ""
        return json.dumps(data, ensure_ascii=False)

    def render_examples(self, i: DpdHeadword) -> str:
        """Trích xuất Examples JSON."""
        if not (i.meaning_1 and i.example_1):
            return ""
            
        data = []
        
        ex1 = {
            self._k("source"): i.source_1,
            self._k("sutta"): i.sutta_1,
            self._k("text"): i.example_1
        }
        data.append(ex1)
        
        if i.example_2:
            ex2 = {
                self._k("source"): i.source_2,
                self._k("sutta"): i.sutta_2,
                self._k("text"): i.example_2
            }
            data.append(ex2)
            
        return json.dumps(data, ensure_ascii=False)