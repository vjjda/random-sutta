# Path: src/dict_builder/renderer.py
from src.db.models import DpdHeadword
from .config import BuilderConfig
from .renderers.html_renderer import DpdHtmlRenderer
from .renderers.json_renderer import DpdJsonRenderer

class DpdRenderer:
    """
    Facade Class: Cầu nối thống nhất để gọi render.
    Tự động điều phối việc dùng HTML Renderer hay JSON Renderer.
    """
    def __init__(self, config: BuilderConfig):
        self.config = config
        
        # Luôn khởi tạo JSON Renderer (nhẹ, không tốn resource)
        self.json_renderer = DpdJsonRenderer()
        
        # HTML Renderer chỉ khởi tạo khi cần (để tránh load templates dư thừa)
        self.html_renderer = None
        if self.config.html_mode:
            self.html_renderer = DpdHtmlRenderer(config)
            
        # Deconstruction luôn cần template (dù ở mode nào)
        # Ta có thể khởi tạo một instance HTML riêng hoặc dùng chung
        if not self.html_renderer:
             # Fallback cho trường hợp JSON mode nhưng vẫn cần render deconstruction HTML
             self.html_renderer = DpdHtmlRenderer(config)

    # =========================================================================
    # HTML DELEGATION (Called when --html is True)
    # =========================================================================
    
    def render_entry(self, i: DpdHeadword) -> str:
        return self.html_renderer.render_content_entry(i)

    def render_grammar(self, i: DpdHeadword) -> str:
        return self.html_renderer.render_grammar_table(i)

    def render_examples(self, i: DpdHeadword) -> str:
        return self.html_renderer.render_example_block(i)

    # =========================================================================
    # JSON DELEGATION (Called when default)
    # =========================================================================

    def extract_definition_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_definition(i)

    def extract_grammar_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_grammar(i)

    def extract_example_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_examples(i)

    # =========================================================================
    # SHARED / MIXED
    # =========================================================================

    def render_deconstruction(self, i) -> str:
        """Deconstruction hiện tại luôn trả về HTML string (dù ở mode nào)."""
        return self.html_renderer.render_deconstruction_card(
            i.lookup_key, 
            i.deconstructor_unpack_list
        )