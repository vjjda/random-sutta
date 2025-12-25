# Path: src/dict_builder/logic/parallel_processor.py
import logging
from concurrent.futures import ProcessPoolExecutor
from typing import Callable, List, Any

logger = logging.getLogger("dict_builder")

class ParallelProcessor:
    """
    Quản lý việc thực thi đa luồng an toàn (ProcessPoolExecutor).
    """
    
    def __init__(self):
        self.executor = None

    def run_safe(self, 
                 worker_func: Callable, 
                 chunks: List[Any], 
                 label: str, 
                 total_items: int, 
                 result_handler: Callable, 
                 *args,
                 **kwargs) -> None: # [FIXED] Added **kwargs support
        """
        Chạy worker_func song song cho từng chunk.
        Đảm bảo thứ tự nhận kết quả (submission order) để giữ tính nhất quán của dữ liệu.
        Hỗ trợ truyền cả positional args (*args) và keyword args (**kwargs) cho worker.
        """
        if not chunks:
            return

        logger.info(f"[green]Processing {total_items} {label} in {len(chunks)} chunks...[/green]")
        processed_count = 0
        
        try:
            with ProcessPoolExecutor() as executor:
                self.executor = executor
                # Submit all tasks with both args and kwargs
                futures = [executor.submit(worker_func, chunk, *args, **kwargs) for chunk in chunks]
                
                # Consume results strictly in order of submission
                for future in futures:
                    try:
                        result = future.result()
                        processed_count += result_handler(result)
                        logger.info(f"   Saved {label}... ({processed_count}/{total_items})")
                    except Exception as e:
                        logger.error(f"[red]{label} batch error: {e}")
                        
        except KeyboardInterrupt:
            logger.warning("\n[bold yellow]⚠️ User interrupted! Shutting down workers...[/bold yellow]")
            if self.executor:
                self.executor.shutdown(wait=False, cancel_futures=True)
            raise