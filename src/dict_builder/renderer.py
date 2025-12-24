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
        if not self.config.is_tiny_mode:
            self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
            self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
            self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    def render_entry(self, i: DpdHeadword) -> str:
        summary = f"{i.pos}. "
        if i.plus_case:
            summary += f"({i.plus_case}) "
        summary += i.meaning_combo_html
        
        if i.construction_summary:
            summary += f" [{i.construction_summary}]"
        
        summary += f" {i.degree_of_completion_html}"

        return self.tpl_entry.render(i=i, summary=summary)

    def render_grammar(self, i: DpdHeadword) -> str:
        if not i.meaning_1:
            return ""
        grammar_line = make_grammar_line(i)
        return self.tpl_grammar.render(i=i, grammar=grammar_line)

    def render_examples(self, i: DpdHeadword) -> str:
        if i.meaning_1 and i.example_1:
            return self.tpl_example.render(i=i)
        return ""

    def render_deconstruction(self, i) -> str:
        return self.tpl_deconstruction.render(
            construction=i.lookup_key,
            deconstruction="<br/>".join(i.deconstructor_unpack_list)
        )

    # [UPDATED] Tối ưu hóa: Chỉ lưu 1 trường 'meaning' duy nhất
    def extract_definition_json(self, i: DpdHeadword) -> str:
        """Đóng gói thông tin định nghĩa vào JSON gọn nhẹ."""
        
        # Logic chọn meaning: Ưu tiên meaning_1, fallback sang meaning_2
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        data = {
            "p": i.pos,         # Rút gọn key 'pos' -> 'p'
            "m": final_meaning  # Rút gọn key 'meaning' -> 'm'
        }
        
        # Chỉ thêm các trường nếu có dữ liệu
        if i.meaning_lit:
            data["l"] = i.meaning_lit # 'lit' -> 'l'
            
        if i.plus_case:
            data["c"] = i.plus_case   # 'plus_case' -> 'c' (case)
        
        if i.construction_summary:
            data["s"] = i.construction_summary # 'construction' -> 's' (structure)
            
        if i.degree_of_completion:
            data["d"] = i.degree_of_completion # 'degree' -> 'd'
            
        return json.dumps(data, ensure_ascii=False)