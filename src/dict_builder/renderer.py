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
        self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
        self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    def render_entry(self, i: DpdHeadword) -> str:
        """Render phần định nghĩa chính."""
        summary = f"{i.pos}. "
        if i.plus_case:
            summary += f"({i.plus_case}) "
        summary += i.meaning_combo_html
        
        if i.construction_summary:
            summary += f" [{i.construction_summary}]"
        
        summary += f" {i.degree_of_completion_html}"

        return self.tpl_entry.render(i=i, summary=summary)

    def render_examples(self, i: DpdHeadword) -> str:
        if i.meaning_1 and i.example_1:
            return self.tpl_example.render(i=i)
        return ""

    def render_deconstruction(self, i) -> str:
        return self.tpl_deconstruction.render(
            construction=i.lookup_key,
            deconstruction="<br/>".join(i.deconstructor_unpack_list)
        )

    def extract_grammar_data(self, i: DpdHeadword) -> str:
        """
        Trích xuất dữ liệu grammar khớp hoàn toàn với ebook_grammar.html cũ.
        """
        if not i.meaning_1:
            return ""

        data = {}

        # 1. Grammar Line (Tổng hợp)
        grammar_line = make_grammar_line(i)
        if grammar_line:
            data["grammar"] = grammar_line

        # 2. Root Family 
        if i.family_root: 
            data["family_root"] = i.family_root

        # 3. Root Info (Chi tiết từ bảng dpd_roots) 
        if i.root_key and i.rt:
            root_info = {
                "clean": i.root_clean,     # √kaṅkh
                "has_verb": i.rt.root_has_verb, # <sup>...</sup>
                "group": i.rt.root_group,  # 1
                "sign": i.root_sign,       # a
                "meaning": i.rt.root_meaning # (doubt)
            }
            # Root in Sandhi (comps) 
            if i.rt.root_in_comps:
                root_info["in_comps"] = i.rt.root_in_comps
            
            # Sanskrit Root 
            if i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
                root_info["sanskrit"] = {
                    "root": i.rt.sanskrit_root,
                    "class": i.rt.sanskrit_root_class,
                    "meaning": i.rt.sanskrit_root_meaning
                }
            
            data["root"] = root_info

        # 4. Base 
        if i.root_base: 
            data["root_base"] = i.root_base

        # 5. Construction 
        if i.construction: 
            data["construction"] = i.construction.replace("\n", "<br>")

        # 6. Derivative 
        if i.derivative: 
            data["derivative"] = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative

        # 7. Phonetic 
        if i.phonetic: 
            data["phonetic"] = i.phonetic.replace("\n", "<br>")
        
        # 8. Compound 
        if i.compound_type and "?" not in i.compound_type:
            data["compound"] = f"{i.compound_type} ({i.compound_construction})"

        # 9. Related Words 
        if i.antonym: data["antonym"] = i.antonym
        if i.synonym: data["synonym"] = i.synonym
        if i.variant: data["variant"] = i.variant
        
        # 10. Commentary & Notes 
        if i.commentary and i.commentary != "-": 
            data["commentary"] = i.commentary.replace("\n", "<br>")
        if i.notes: 
            data["notes"] = i.notes.replace("\n", "<br>")
        
        # 11. Cognate 
        if i.cognate: data["cognate"] = i.cognate

        # 12. Links 
        if i.link:
            data["link"] = i.link.split("\n")

        # 13. Non IA 
        if i.non_ia: data["non_ia"] = i.non_ia

        # 14. Sanskrit 
        if i.sanskrit: data["sanskrit"] = i.sanskrit

        # Note: Bỏ qua IPA để tránh phụ thuộc thư viện nặng aksharamukha
        # Nếu cần thiết, có thể thêm vào sau.

        if not data:
            return ""

        return json.dumps(data, ensure_ascii=False)