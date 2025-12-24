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
        # [REMOVED] tpl_grammar - Không cần template grammar nữa
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

    # [NEW] Hàm trích xuất dữ liệu grammar thành JSON
    def extract_grammar_data(self, i: DpdHeadword) -> str:
        """
        Trích xuất các thông tin ngữ pháp quan trọng thành JSON.
        Chỉ đưa vào các trường có dữ liệu để tiết kiệm dung lượng.
        """
        if not i.meaning_1:
            return ""

        data = {}

        # 1. Grammar Line (Tổng hợp Pos, Verb, Case...)
        grammar_line = make_grammar_line(i)
        if grammar_line:
            data["grammar"] = grammar_line

        # 2. Root Info
        if i.root_key:
            root_info = {
                "key": i.root_key,
                "clean": i.root_clean,
                "sign": i.root_sign,
                "meaning": "", # Sẽ lấy từ relation rt nếu có
                "group": "",
                "has_verb": ""
            }
            # Lấy thông tin từ bảng DpdRoot (relation rt)
            if i.rt:
                root_info["meaning"] = i.rt.root_meaning
                root_info["group"] = i.rt.root_group
                root_info["has_verb"] = i.rt.root_has_verb
            
            data["root"] = root_info
            
            if i.root_base:
                data["root_base"] = i.root_base

        # 3. Family & Relations
        if i.family_root: data["family_root"] = i.family_root
        if i.family_word: data["family_word"] = i.family_word
        if i.family_compound: data["family_compound"] = i.family_compound
        if i.family_idioms: data["family_idioms"] = i.family_idioms
        if i.family_set: data["family_set"] = i.family_set

        # 4. Construction & Morphology
        if i.construction: data["construction"] = i.construction.replace("\n", "<br>")
        if i.derivative: data["derivative"] = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
        if i.phonetic: data["phonetic"] = i.phonetic.replace("\n", "<br>")
        
        # 5. Compound Info
        if i.compound_type and "?" not in i.compound_type:
            data["compound"] = f"{i.compound_type} ({i.compound_construction})"

        # 6. Related Words
        if i.antonym: data["antonym"] = i.antonym
        if i.synonym: data["synonym"] = i.synonym
        if i.variant: data["variant"] = i.variant
        if i.cognate: data["cognate"] = i.cognate

        # 7. Commentary & Notes
        if i.commentary and i.commentary != "-": 
            data["commentary"] = i.commentary.replace("\n", "<br>")
        if i.notes: 
            data["notes"] = i.notes.replace("\n", "<br>")
        
        # 8. Origin
        if i.sanskrit: data["sanskrit"] = i.sanskrit
        if i.origin: data["origin"] = i.origin

        # 9. Links
        if i.link:
            data["link"] = i.link.replace("\n", "<br>")

        # Nếu không có dữ liệu gì đáng kể thì trả về rỗng để đỡ tốn DB
        if not data:
            return ""

        return json.dumps(data, ensure_ascii=False)