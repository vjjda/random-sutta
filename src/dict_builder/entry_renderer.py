# Path: src/dict_builder/entry_renderer.py
from src.dict_builder.db.models import DpdHeadword
from .builder_config import BuilderConfig
from .renderers.json_renderer import DpdJsonRenderer

class DpdRenderer:
    """
    Facade Class: Cầu nối thống nhất để gọi render.
    [CLEANUP] Đã loại bỏ logic HTML.
    """
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.json_renderer = DpdJsonRenderer()

    # =========================================================================
    # JSON DELEGATION
    # =========================================================================

    def extract_definition_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_definition(i)

    def extract_grammar_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_grammar(i)

    def extract_example_json(self, i: DpdHeadword) -> str:
        return self.json_renderer.render_examples(i)

    def extract_root_json(self, r) -> str:
        return self.json_renderer.render_root_definition(r)

    def render_grammar_notes_json(self, grammar_list: list) -> str:
        return self.json_renderer.render_grammar_notes(grammar_list)