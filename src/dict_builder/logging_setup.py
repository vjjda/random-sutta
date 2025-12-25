# Path: src/dict_builder/logging_setup.py
import logging
import logging.config
from pathlib import Path
from rich.logging import RichHandler

def setup_dict_builder_logging():
    """
    Setup logging specifically for dict_builder using RichHandler for console.
    """
    project_root = Path(__file__).parents[2]
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)
    log_file = logs_dir / "dict_builder.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[
            RichHandler(rich_tracebacks=True, show_path=False, markup=True),
            logging.FileHandler(log_file, mode='w', encoding='utf-8')
        ]
    )
    
    # Silence third-party loggers if needed
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    return logging.getLogger("dict_builder")
