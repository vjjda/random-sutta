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
        # [UPDATED] Không cần load template HTML cho Entry/Grammar/Example nữa vì dùng JSON hết
        if not self.config.is_tiny_mode and self.config.mode != "mini":
            # Chỉ load nếu có mode nào đó vẫn dùng HTML (ví dụ Full sau này nếu cần)
            self.tpl_entry = Template(filename=str(self.config.TEMPLATES_DIR / "entry.html"))
            self.tpl_grammar = Template(filename=str(self.config.TEMPLATES_DIR / "grammar.html"))
            self.tpl_example = Template(filename=str(self.config.TEMPLATES_DIR / "example.html"))
        
        # Deconstruction vẫn dùng HTML (hoặc có thể chuyển JSON nốt nếu bạn muốn sau này)
        self.tpl_deconstruction = Template(filename=str(self.config.TEMPLATES_DIR / "deconstruction.html"))

    # ... (Các hàm render_html cũ có thể giữ lại hoặc bỏ nếu không dùng) ...
    
    def render_deconstruction(self, i) -> str:
        return self.tpl_deconstruction.render(
            construction=i.lookup_key,
            deconstruction="<br/>".join(i.deconstructor_unpack_list)
        )

    def extract_definition_json(self, i: DpdHeadword) -> str:
        """Đóng gói thông tin định nghĩa vào JSON (Dùng chung cho Tiny và Mini)."""
        final_meaning = i.meaning_1 if i.meaning_1 else i.meaning_2
        
        data = {
            "p": i.pos,         # pos
            "m": final_meaning  # meaning
        }
        
        if i.meaning_lit: data["l"] = i.meaning_lit
        if i.plus_case: data["c"] = i.plus_case
        if i.construction_summary: data["s"] = i.construction_summary
        if i.degree_of_completion: data["d"] = i.degree_of_completion
            
        return json.dumps(data, ensure_ascii=False)

    # [NEW] Trích xuất Grammar JSON theo key-value yêu cầu
    def extract_grammar_json(self, i: DpdHeadword) -> str:
        if not i.meaning_1:
            return ""

        data = {}

        # 1. Grammar
        grammar_line = make_grammar_line(i)
        if grammar_line:
            data["Grammar"] = grammar_line

        # 2. Root Family
        if i.family_root:
            data["Root Family"] = i.family_root

        # 3. Root (Format: √root + superscript + group + sign + meaning)
        if i.root_key and i.rt:
            # Tạo chuỗi value giống hiển thị HTML
            # √kaṅkh + ･ + 1 + a + (doubt)
            root_str = f"{i.root_clean}{i.rt.root_has_verb}{i.rt.root_group} {i.root_sign} ({i.rt.root_meaning})"
            data["Root"] = root_str
            
            # 3.1 Root In Sandhi (Nếu có)
            if i.rt.root_in_comps:
                data["√ In Sandhi"] = i.rt.root_in_comps

        # 4. Base
        if i.root_base:
            data["Base"] = i.root_base

        # 5. Construction
        if i.construction:
            # Giữ lại <br> hoặc thay bằng \n tùy bạn, ở đây replace \n -> <br> cho giống web
            data["Construction"] = i.construction.replace("\n", "<br>")

        # 6. Derivative
        if i.derivative:
            val = f"{i.derivative} ({i.suffix})" if i.suffix else i.derivative
            data["Derivative"] = val

        # 7. Phonetic Change
        if i.phonetic:
            data["Phonetic Change"] = i.phonetic.replace("\n", "<br>")

        # 8. Compound
        if i.compound_type and "?" not in i.compound_type:
            val = f"{i.compound_type} ({i.compound_construction})"
            data["Compound"] = val

        # 9. Relations
        if i.antonym: data["Antonym"] = i.antonym
        if i.synonym: data["Synonym"] = i.synonym
        if i.variant: data["Variant"] = i.variant

        # 10. Notes
        if i.commentary and i.commentary != "-":
            data["Commentary"] = i.commentary.replace("\n", "<br>")
        if i.notes:
            data["Notes"] = i.notes.replace("\n", "<br>")
        if i.cognate:
            data["English Cognate"] = i.cognate
            
        # 11. Links
        if i.link:
            # Có thể lưu dạng list hoặc string join
            data["Web Link"] = i.link 

        # 12. Non IA
        if i.non_ia:
            data["Non IA"] = i.non_ia

        # 13. Sanskrit
        if i.sanskrit:
            data["Sanskrit"] = i.sanskrit

        # 14. Sanskrit Root
        if i.root_key and i.rt and i.rt.sanskrit_root and i.rt.sanskrit_root != "-":
            # Format: √śaṅk 1 (doubt)
            ss_str = f"{i.rt.sanskrit_root} {i.rt.sanskrit_root_class} ({i.rt.sanskrit_root_meaning})"
            data["Sanskrit Root"] = ss_str

        if not data:
            return ""

        return json.dumps(data, ensure_ascii=False)

    # [NEW] Trích xuất Example JSON
    def extract_example_json(self, i: DpdHeadword) -> str:
        if not (i.meaning_1 and i.example_1):
            return ""
            
        data = []
        
        # Example 1
        ex1 = {
            "source": i.source_1,
            "sutta": i.sutta_1,
            "text": i.example_1
        }
        data.append(ex1)
        
        # Example 2 (Nếu có)
        if i.example_2:
            ex2 = {
                "source": i.source_2,
                "sutta": i.sutta_2,
                "text": i.example_2
            }
            data.append(ex2)
            
        return json.dumps(data, ensure_ascii=False)