# Path: src/dict_builder/renderers/html_renderer.py
from mako.template import Template
from src.dict_builder.db.models import DpdHeadword
from src.dict_builder.tools.meaning_construction import make_grammar_line
from ..builder_config import BuilderConfig

class DpdHtmlRenderer:
    """
    Chuyên trách việc render HTML từ Mako Templates.
    Dùng cho mode --html hoặc các thành phần bắt buộc phải là HTML.
    """
    def __init__(self, config: BuilderConfig):
        self.config = config
        self._load_templates()

    def _load_templates(self):
        self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
        self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
        self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))
        self.tpl_grammar_note = Template(filename=str(self.config.TEMPLATES_DIR / "grammar_note.html"))

    def render_content_entry(self, i: DpdHeadword) -> str:
        summary = f"{i.pos}. "
        if i.plus_case:
            summary += f"({i.plus_case}) "
        summary += i.meaning_combo_html
        
        if i.construction_summary:
            summary += f" [{i.construction_summary}]"
        
        summary += f" {i.degree_of_completion_html}"

        return self.tpl_entry.render(i=i, summary=summary)

    def render_grammar_table(self, i: DpdHeadword) -> str:
        if not i.meaning_1:
            return ""
        
        grammar_line = make_grammar_line(i)
        return self.tpl_grammar.render(
            i=i,
            grammar=grammar_line
        )

    def render_example_block(self, i: DpdHeadword) -> str:
        if i.meaning_1 and i.example_1:
            return self.tpl_example.render(i=i)
        return ""

    def render_deconstruction_card(self, lookup_key: str, unpack_list: list) -> str:
        return self.tpl_deconstruction.render(
            construction=lookup_key,
            deconstruction="<br/>".join(unpack_list)
        )

    def render_grammar_notes(self, grammar_list: list) -> str:
        """
        Render Grammar Note Table matching original DPD logic.
        Structure: Word | POS | G1 | G2 | G3
        """
        # Sort by headword (0) then pos (1)
        sorted_list = sorted(grammar_list, key=lambda x: (x[0], x[1]))
        
        rows = []
        for word, pos, grammar_str in sorted_list:
            row_data = {
                "pos": pos,
                "word": word,
                "g1": "",
                "g2": "",
                "g3": "",
                "full_col_text": None  # If set, spans all 3 columns (e.g. "in comps")
            }

            # Logic from original author
            if grammar_str.startswith("reflx"):
                parts = grammar_str.split()
                # "reflx pron" + rest
                if len(parts) >= 2:
                    row_data["g1"] = f"{parts[0]} {parts[1]}"
                    remaining = parts[2:]
                    if len(remaining) > 0: row_data["g2"] = remaining[0]
                    if len(remaining) > 1: row_data["g3"] = " ".join(remaining[1:])
                else:
                    # Fallback if weird string
                    row_data["g1"] = grammar_str

            elif grammar_str.startswith("in comps"):
                row_data["full_col_text"] = grammar_str
            
            else:
                parts = grammar_str.split()
                while len(parts) < 3:
                    parts.append("")
                
                # If more than 3, join remainder into last part (or ignore? original code ignored logic but just appended)
                # Original logic: just loop and add <td>. We map to 3 slots.
                row_data["g1"] = parts[0]
                row_data["g2"] = parts[1]
                # Join any remaining parts into g3 just in case
                row_data["g3"] = " ".join(parts[2:])
            
            rows.append(row_data)

        return self.tpl_grammar_note.render(rows=rows)