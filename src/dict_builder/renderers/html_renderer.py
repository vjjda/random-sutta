# Path: src/dict_builder/renderers/html_renderer.py
from mako.template import Template
from src.db.models import DpdHeadword
from src.tools.meaning_construction import make_grammar_line
from ..config import BuilderConfig

class DpdHtmlRenderer:
    """
    Chuyên trách việc render HTML từ Mako Templates.
    Dùng cho mode --html hoặc các thành phần bắt buộc phải là HTML (như Deconstruction).
    """
    def __init__(self, config: BuilderConfig):
        self.config = config
        self._load_templates()

    def _load_templates(self):
        # Load các template chính
        self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
        self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
        self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    def render_content_entry(self, i: DpdHeadword) -> str:
        """Render nội dung định nghĩa chính (Definition HTML)."""
        summary = f"{i.pos}. "
        if i.plus_case:
            summary += f"({i.plus_case}) "
        summary += i.meaning_combo_html
        
        if i.construction_summary:
            summary += f" [{i.construction_summary}]"
        
        summary += f" {i.degree_of_completion_html}"

        return self.tpl_entry.render(i=i, summary=summary)

    def render_grammar_table(self, i: DpdHeadword) -> str:
        """Render bảng ngữ pháp (Grammar HTML)."""
        if not i.meaning_1:
            return ""
        
        grammar_line = make_grammar_line(i)
        return self.tpl_grammar.render(
            i=i,
            grammar=grammar_line
        )

    def render_example_block(self, i: DpdHeadword) -> str:
        """Render khối ví dụ (Examples HTML)."""
        if i.meaning_1 and i.example_1:
            return self.tpl_example.render(i=i)
        return ""

    def render_deconstruction_card(self, lookup_key: str, unpack_list: list) -> str:
        """Render thẻ phân tích từ (Deconstruction HTML)."""
        return self.tpl_deconstruction.render(
            construction=lookup_key,
            deconstruction="<br/>".join(unpack_list)
        )