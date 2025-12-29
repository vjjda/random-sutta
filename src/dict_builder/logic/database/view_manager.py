# Path: src/dict_builder/logic/database/view_manager.py
import logging
from sqlite3 import Cursor
from ...builder_config import BuilderConfig
from .views.search_system import SearchSystemBuilder
from .views.grand_view import GrandViewBuilder
from .views.lookup_system import LookupSystemBuilder

logger = logging.getLogger("dict_builder.views")

class ViewManager:
    """
    Orchestrator for creating Database Views.
    Delegates actual SQL generation to specialized builders in `views/`.
    """
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    def create_all_views(self):
        """Execute all view creation strategies."""
        # 1. Frontend / Production Views (Search)
        SearchSystemBuilder(self.cursor, self.config).create()

        # 2. Frontend / Production Views (Lookup)
        LookupSystemBuilder(self.cursor, self.config).create()
        
        # 3. Debug / Overview Views
        GrandViewBuilder(self.cursor, self.config).create()
