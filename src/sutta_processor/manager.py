# Path: src/sutta_processor/manager.py
import json
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any
from pathlib import Path

from .config import (
    OUTPUT_SUTTA_BASE, 
    OUTPUT_SUTTA_BOOKS, 
    PROCESSED_DIR,
    PROCESS_LIMIT,
    DATA_ROOT # Cần import để đọc lại file tree khi write
)
from .finder import generate_book_tasks
from .converter import process_worker
from .name_parser import load_names_map 

logger = logging.getLogger("SuttaProcessor")

class SuttaManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        if self.dry_run:
            logger.info("🧪 RUNNING IN DRY-RUN MODE")
            self.output_base = PROCESSED_DIR
            self.json_indent = 2
        else:
            logger.info("🚀 RUNNING IN PRODUCTION MODE")
            self.output_base = OUTPUT_SUTTA_BOOKS
            self.json_indent = None

        self.buffers: Dict[str, Dict[str, Any]] = {} 
        self.book_totals: Dict[str, int] = {}       
        self.book_progress: Dict[str, int] = {}      
        self.completed_books: List[str] = []
        self.sutta_group_map: Dict[str, str] = {}

    # ... (Giữ nguyên hàm run, _update_progress_and_flush_if_ready, _prepare_output_dir) ...
    # Chỉ copy phần run từ phiên bản trước nếu bạn chưa lưu, 
    # nhưng quan trọng nhất là hàm _write_single_book dưới đây

    def run(self):
        # (Copy lại logic run từ bước trước, giữ nguyên Map-Reduce)
        self._prepare_output_dir()
        book_tasks = generate_book_tasks(limit=PROCESS_LIMIT)
        all_tasks = []
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            for sutta_id, path in tasks:
                all_tasks.append((sutta_id, path))
                self.sutta_group_map[sutta_id] = group_name

        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items from {len(book_tasks)} books with {workers} workers...")

        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_group, res_sid, content = future.result()
                    target_group = self.sutta_group_map.get(res_sid)
                    if not target_group: continue
                    if content: self.buffers[target_group][res_sid] = content
                    self._update_progress_and_flush_if_ready(target_group)
                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")
                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} total items...")

        if not self.dry_run:
            self._write_loader(self.completed_books)
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _update_progress_and_flush_if_ready(self, group: str):
        self.book_progress[group] += 1
        if self.book_progress[group] >= self.book_totals[group]:
            if self.buffers.get(group): 
                generated_file = self._write_single_book(group, self.buffers[group])
                self.completed_books.append(generated_file)
            else:
                logger.info(f"   ℹ️  Skipped Book: {group} (No valid content)")
            if group in self.buffers:
                del self.buffers[group]

    def _enrich_tree_structure(self, node: Any) -> Any:
        """
        Đệ quy duyệt cây (tree.json data) và bổ sung metadata cho các nhánh.
        """
        if isinstance(node, str):
            # Đây là Leaf (Sutta UID). Trả về nguyên gốc string để làm reference.
            return node
        
        elif isinstance(node, list):
            return [self._enrich_tree_structure(child) for child in node]
        
        elif isinstance(node, dict):
            # Đây là Branch (Ví dụ: {"mn-mulapannasa": [...]})
            enriched_node = {}
            for key, children in node.items():
                # Lấy metadata cho node này (nếu có)
                meta = self.names_map.get(key, {})
                
                enriched_node = {
                    "uid": key,
                    "type": "branch",
                    # Metadata cho nhánh
                    "acronym": meta.get("acronym"),
                    "translated_title": meta.get("translated_title"),
                    "original_title": meta.get("original_title"),
                    "blurb": meta.get("blurb"),
                    # Đệ quy cho con
                    "children": self._enrich_tree_structure(children)
                }
                # Thường dict tree chỉ có 1 key, nên return luôn
                return enriched_node
        return node

    def _load_original_tree(self, group_name: str) -> List[Any]:
        """Đọc file tree.json gốc để lấy cấu trúc."""
        # group_name: sutta/mn -> data/bilara/tree/sutta/mn-tree.json
        # Lấy phần cuối của group làm tên sách: mn
        book_id = group_name.split("/")[-1]
        tree_path = DATA_ROOT / "tree" / group_name / f"{book_id}-tree.json"
        
        # Nếu path chưa đúng (ví dụ do group name phức tạp), ta thử dùng logic file
        if not tree_path.exists():
            # Fallback: tìm trong folder tree
            found = list((DATA_ROOT / "tree").rglob(f"{book_id}-tree.json"))
            if found:
                tree_path = found[0]
            else:
                return []

        try:
            with open(tree_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Dữ liệu tree thường là { "mn": [...] } -> Lấy value của root key
                if isinstance(data, dict):
                    return list(data.values())[0] # Trả về list children cấp 1
                return []
        except Exception:
            return []

    def _write_single_book(self, group_name: str, raw_data: Dict[str, Any]) -> str:
        """Ghi file sách với cấu trúc mới: { structure: [...], suttas: {...} }"""
        
        # 1. Xây dựng Structure (Mục lục)
        raw_tree = self._load_original_tree(group_name)
        enriched_structure = self._enrich_tree_structure(raw_tree)

        # 2. Xây dựng Suttas Dictionary (Nội dung)
        # Không cần sort key ở đây vì thứ tự hiển thị sẽ dựa vào structure
        suttas_dict = {}
        for sid, content in raw_data.items():
            name_info = self.names_map.get(sid, {
                "acronym": "", "translated_title": "", "original_title": "", "blurb": None
            })
            
            suttas_dict[sid] = {
                "acronym": name_info["acronym"],
                "translated_title": name_info["translated_title"],
                "original_title": name_info["original_title"],
                "blurb": name_info.get("blurb"), # Thêm blurb cho bài kinh
                "content": content
            }

        # 3. Object cuối cùng
        # Lấy thông tin Metadata của chính cuốn sách (ví dụ: mn)
        book_id = group_name.split("/")[-1]
        book_meta = self.names_map.get(book_id, {})
        
        final_output = {
            "id": book_id,
            "title": book_meta.get("translated_title", book_id.upper()),
            "structure": enriched_structure,
            "suttas": suttas_dict
        }

        # 4. Ghi file
        if self.dry_run:
            file_name = f"{group_name}.json"
            file_path = self.output_base / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(final_output, f, ensure_ascii=False, indent=self.json_indent)
        else:
            file_name = f"{group_name}.js"
            file_path = self.output_base / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            json_str = json.dumps(final_output, ensure_ascii=False, indent=self.json_indent)
            safe_group = group_name.replace("/", "_")
            js_content = f"window.SUTTA_DB = window.SUTTA_DB || {{}}; window.SUTTA_DB['{safe_group}'] = {json_str};"
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)
        
        logger.info(f"   💾 Saved: {file_name} ({len(suttas_dict)} suttas)")
        return file_name

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)