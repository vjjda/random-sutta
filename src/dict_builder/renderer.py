# Path: src/dict_builder/renderer.py
import json
from mako.template import Template
from src.db.models import DpdHeadword
from src.tools.meaning_construction import make_grammar_line, make_meaning_combo_html
from .config import BuilderConfig

class DpdRenderer:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self._load_templates()

    def _load_templates(self):
        if not self.config.is_tiny_mode and self.config.mode != "mini":
            self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
            self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
            self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    def render_deconstruction(self, i) -> str:
        return self.tpl_deconstruction.render(
            construction=i.lookup_key,
            deconstruction="<br/>".join(i.deconstructor_unpack_list)
        )

    # [UPDATED] Sử dụng Full Key name cho rõ nghĩa
    def extract_definition_json(self, i: DpdHeadword) -> str:
        """Đóng gói thông tin định nghĩa vào JSON (Dùng chung cho Tiny và Mini)."""
        
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        data = {
            "pos": i.pos,         # p -> pos
            "meaning": final_meaning  # m -> meaning
        }
        
        # Các trường tùy chọn
        if i.meaning_lit: 
            data["meaning_lit"] = i.meaning_lit  # l -> meaning_lit
            
        if i.plus_case: 
            data["plus_case"] = i.plus_case    # c -> plus_case
        
        if i.construction_summary: 
            data["construction"] = i.construction_summary # s -> construction
            
        if i.degree_of_completion: 
            data["degree"] = i.degree_of_completion # d -> degree
            
        return json.dumps(data, ensure_ascii=False)

    def extract_grammar_json(self, i: DpdHeadword) -> str:
        if not i.meaning_1:
            return ""

        data = {}
        # ... (Phần logic extract_grammar_json giữ nguyên như cũ) ...
        # (Tôi rút gọn đoạn này để hiển thị code tập trung vào thay đổi chính)
        
        grammar_line = make_grammar_line(i)
        if grammar_line: data["Grammar"] = grammar_line
        if i.family_root: data["Root Family"] = i.family_root

        if i.root_key and i.rt:
            root_str = f"{i.root_clean}{i.rt.root_has_verb}{i.rt.root_group} {i.root_sign} ({i.rt.root_meaning})"
            data["Root"] = root_str
            if i.rt.root_in_comps: data["√ In Sandhi"] = i.rt.root_in_comps

        if i.root_base: data["Base"] = i.root_base
        if i.construction: data["Construction"] = i.construction.replace("\n", "<br>")
        if i.derivative:
            val = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
            data["Derivative"] = val
        if i.phonetic: data["Phonetic Change"] = i.phonetic.replace("\n", "<br>")
        if i.compound_type and "?" not in i.compound_type:
            val = f"{i.compound_type} ({i.compound_construction})"
            data["Compound"] = val

        if i.antonym: data["Antonym"] = i.antonym
        if i.synonym: data["Synonym"] = i.synonym
        if i.variant: data["Variant"] = i.variant

        if i.commentary and i.commentary != "-": data["Commentary"] = i.commentary.replace("\n", "<br>")
        if i.notes: data["Notes"] = i.notes.replace("\n", "<br>")
        if i.cognate: data["English Cognate"] = i.cognate
        if i.link: data["Web Link"] = i.link 
        if i.non_ia: data["Non IA"] = i.non_ia
        if i.sanskrit: data["Sanskrit"] = i.sanskrit

        if i.root_key and i.rt and i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
            ss_str = f"{i.rt.sanskrit_root} {i.rt.sanskrit_root_class} ({i.rt.sanskrit_root_meaning})"
            data["Sanskrit Root"] = ss_str

        if not data: return ""
        return json.dumps(data, ensure_ascii=False)

    def extract_example_json(self, i: DpdHeadword) -> str:
        if not (i.meaning_1 and i.example_1):
            return ""
        data = []
        ex1 = {"source": i.source_1, "sutta": i.sutta_1, "text": i.example_1}
        data.append(ex1)
        if i.example_2:
            ex2 = {"source": i.source_2, "sutta": i.sutta_2, "text": i.example_2}
            data.append(ex2)
        return json.dumps(data, ensure_ascii=False)