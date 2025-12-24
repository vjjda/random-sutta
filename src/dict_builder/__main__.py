# Path: src/dict_builder/__main__.py
import sys
import multiprocessing
from .core import run_builder

if __name__ == "__main__":
    # Fix cho macOS start method nếu cần (thường mặc định là 'spawn' trên Python mới)
    # multiprocessing.set_start_method('spawn') 
    
    # Hỗ trợ switch mode đơn giản
    mode = "mini"
    if "--full" in sys.argv:
        mode = "full"
        
    from .core import DictBuilder
    builder = DictBuilder(mode=mode)
    builder.run()