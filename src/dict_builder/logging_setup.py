# Path: src/dict_builder/logging_setup.py
import logging
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

    # Create logger
    logger = logging.getLogger("dict_builder")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    
    # Remove existing handlers to avoid duplicates if called multiple times
    if logger.hasHandlers():
        logger.handlers.clear()

    # Console Handler (Rich)
    console_handler = RichHandler(
        rich_tracebacks=True, 
        show_path=False, 
        markup=True,
        show_time=True,
        show_level=True
    )
    console_handler.setFormatter(logging.Formatter("%(message)s", datefmt="[%X]"))
    logger.addHandler(console_handler)

    # File Handler
    file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(file_handler)
    
    # Silence third-party loggers
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    return logger