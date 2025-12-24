# Path: src/dict_builder/renderers/json_renderer.py
import json
from src.db.models import DpdHeadword
from src.tools.meaning_construction import make_grammar_line

class DpdJsonRenderer:
    """
    Chuyên trách việc trích xuất dữ liệu và format thành JSON.
    Dùng cho các mode mặc định (Tiny, Mini, Full).
    """
    
    def render_definition(self, i: DpdHeadword) -> str:
        """Trích xuất Definition JSON."""
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        data = {
            "pos": i.pos,
            "meaning": final_meaning
        }
        
        if i.meaning_lit: data["meaning_lit"] = i.meaning_lit
        if i.plus_case: data["plus_case"] = i.plus_case
        if i.construction_summary: data["construction"] = i.construction_summary
        if i.degree_of_completion: data["degree"] = i.degree_of_completion
            
        return json.dumps(data, ensure_ascii=False)

    def render_grammar(self, i: DpdHeadword) -> str:
        """Trích xuất Grammar JSON."""
        if not i.meaning_1:
            return ""

        data = {}

        # 1. Grammar Summary
        grammar_line = make_grammar_line(i)
        if grammar_line: data["Grammar"] = grammar_line
        
        # 2. Root Family
        if i.family_root: data["Root Family"] = i.family_root

        # 3. Root Details
        if i.root_key and i.rt:
            root_str = f"{i.root_clean}{i.rt.root_has_verb}{i.rt.root_group} {i.root_sign} ({i.rt.root_meaning})"
            data["Root"] = root_str
            if i.rt.root_in_comps: data["√ In Sandhi"] = i.rt.root_in_comps

        # 4. Construction & Morphology
        if i.root_base: data["Base"] = i.root_base
        if i.construction: data["Construction"] = i.construction.replace("\n", "<br>")
        
        if i.derivative:
            val = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
            data["Derivative"] = val

        if i.phonetic: data["Phonetic Change"] = i.phonetic.replace("\n", "<br>")
        
        if i.compound_type and "?" not in i.compound_type:
            val = f"{i.compound_type} ({i.compound_construction})"
            data["Compound"] = val

        # 5. Relations
        if i.antonym: data["Antonym"] = i.antonym
        if i.synonym: data["Synonym"] = i.synonym
        if i.variant: data["Variant"] = i.variant

        # 6. Notes & Metadata
        if i.commentary and i.commentary != "-": data["Commentary"] = i.commentary.replace("\n", "<br>")
        if i.notes: data["Notes"] = i.notes.replace("\n", "<br>")
        if i.cognate: data["English Cognate"] = i.cognate
        if i.link: data["Web Link"] = i.link 
        if i.non_ia: data["Non IA"] = i.non_ia
        
        # 7. Sanskrit
        if i.sanskrit: data["Sanskrit"] = i.sanskrit

        if i.root_key and i.rt and i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
            ss_str = f"{i.rt.sanskrit_root} {i.rt.sanskrit_root_class} ({i.rt.sanskrit_root_meaning})"
            data["Sanskrit Root"] = ss_str

        if not data: return ""
        return json.dumps(data, ensure_ascii=False)

    def render_examples(self, i: DpdHeadword) -> str:
        """Trích xuất Examples JSON."""
        if not (i.meaning_1 and i.example_1):
            return ""
            
        data = []
        
        ex1 = {
            "source": i.source_1,
            "sutta": i.sutta_1,
            "text": i.example_1
        }
        data.append(ex1)
        
        if i.example_2:
            ex2 = {
                "source": i.source_2,
                "sutta": i.sutta_2,
                "text": i.example_2
            }
            data.append(ex2)
            
        return json.dumps(data, ensure_ascii=False)