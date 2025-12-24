# Path: src/dict_builder/renderer.py
import json
from mako.template import Template
from typing import Any, Dict

from src.db.models import DpdHeadword, Lookup
from src.tools.meaning_construction import make_grammar_line
from .config import BuilderConfig

class DpdRenderer:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self._load_templates()

    def _load_templates(self):
        # Load templates từ thư mục templates/
        self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
        self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
        self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    def extract_json_data(self, i: DpdHeadword) -> str:
        """Trích xuất dữ liệu thô quan trọng ra JSON."""
        data = {
            "id": i.id,
            "pos": i.pos,
            "root_key": i.root_key,
            "family_root": i.family_root,
            "family_word": i.family_word,
            "construction": i.construction,
            "derivative": i.derivative,
            "suffix": i.suffix,
            "phonetic": i.phonetic,
            "compound_type": i.compound_type,
            "antonym": i.antonym,
            "synonym": i.synonym,
            "variant": i.variant,
            "sanskrit": i.sanskrit,
            "audio_url": None # Placeholder nếu sau này có audio link
        }
        # Loại bỏ các key có value là None hoặc rỗng để tiết kiệm dung lượng
        clean_data = {k: v for k, v in data.items() if v}
        return json.dumps(clean_data, ensure_ascii=False)

    def render_grammar(self, i: DpdHeadword) -> str:
        """Render bảng ngữ pháp (Logic giống ebook_grammar.html)."""
        if not i.meaning_1:
            return ""
        
        grammar_line = make_grammar_line(i)
        return self.tpl_grammar.render(i=i, grammar=grammar_line)

    def render_entry(self, i: DpdHeadword, grammar_html: str, example_html: str) -> str:
        """Render phần định nghĩa chính."""
        # Tái tạo logic summary string từ kindle_exporter 
        summary = f"{i.pos}. "
        if i.plus_case:
            summary += f"({i.plus_case}) "
        summary += i.meaning_combo_html
        
        if i.construction_summary:
            summary += f" [{i.construction_summary}]"
        
        summary += f" {i.degree_of_completion_html}"

        return self.tpl_entry.render(
            i=i,
            summary=summary,
            grammar_html=grammar_html,
            example_html=example_html
        )

    def render_examples(self, i: DpdHeadword) -> str:
        if i.meaning_1 and i.example_1:
            return self.tpl_example.render(i=i)
        return ""

    def render_deconstruction(self, i: Lookup) -> str:
        return self.tpl_deconstruction.render(
            construction=i.lookup_key,
            deconstruction="<br/>".join(i.deconstructor_unpack)
        )