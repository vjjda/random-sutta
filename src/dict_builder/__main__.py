# Path: src/dict_builder/__main__.py
import sys
from .core import run_builder

if __name__ == "__main__":
    # Mặc định là mini
    mode = "mini"
    
    # Hỗ trợ switch mode qua CLI arguments
    if "--tiny" in sys.argv:
        mode = "tiny"
    elif "--full" in sys.argv:
        mode = "full"
        
    from .core import DictBuilder
    builder = DictBuilder(mode=mode)
    builder.run()