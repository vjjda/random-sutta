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
    DATA_ROOT
)
from .finder import generate_book_tasks
from .converter import process_worker
from .name_parser import load_names_map 

logger = logging.getLogger("SuttaProcessor")

class SuttaManager:
    # ... (Giữ nguyên phần __init__, run, _prepare_output_dir, _update_progress_and_flush_if_ready) ...
    # Copy nguyên phần đầu từ phiên bản trước, không thay đổi logic core.
    
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

    def run(self):
        self._prepare_output_dir()
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            for task in tasks:
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group_name

        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items...")

        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_status, res_sid, content = future.result()
                    target_group = self.sutta_group_map.get(res_sid)
                    if not target_group: continue
                    if res_status == "success" and content:
                        self.buffers[target_group][res_sid] = content
                    self._update_progress_and_flush_if_ready(target_group)
                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")
                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} items...")

        if not self.dry_run:
            self._write_loader(self.completed_books)
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _prepare_output_dir(self):
        if self.output_base.exists():
            shutil.rmtree(self.output_base)
        self.output_base.mkdir(parents=True, exist_ok=True)

    def _update_progress_and_flush_if_ready(self, group: str):
        self.book_progress[group] += 1
        if self.book_progress[group] >= self.book_totals[group]:
            generated_file = self._write_single_book(group, self.buffers.get(group, {}))
            self.completed_books.append(generated_file)
            if group in self.buffers:
                del self.buffers[group]

    # --- Tree Helpers ---

    def _load_original_tree(self, group_name: str) -> Dict[str, Any]:
        """
        Đọc file tree.json gốc.
        [UPDATE] Nếu không tìm thấy file tree, trả về Synthetic Tree (Cây giả lập).
        """
        book_id = group_name.split("/")[-1]
        tree_path = DATA_ROOT / "tree" / group_name / f"{book_id}-tree.json"
        
        if not tree_path.exists():
            found = list((DATA_ROOT / "tree").rglob(f"{book_id}-tree.json"))
            if found:
                tree_path = found[0]
            else:
                # [EDGE CASE] Không có tree file (như pli-tv-bi-pm)
                # Trả về cấu trúc mặc định để không bị lỗi
                # Manager sẽ tự điền data vào structure dựa trên raw_data
                return {book_id: []} 

        try:
            with open(tree_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {book_id: []}

    def _simplify_structure(self, node: Any) -> Any:
        if isinstance(node, list):
            if all(isinstance(x, str) for x in node):
                return node
            new_dict = {}
            for item in node:
                if isinstance(item, dict):
                    for key, val in item.items():
                        new_dict[key] = self._simplify_structure(val)
            return new_dict
        elif isinstance(node, dict):
            return {k: self._simplify_structure(v) for k, v in node.items()}
        return node

    def _flatten_tree_leaves(self, node: Any) -> List[str]:
        leaves = []
        if isinstance(node, str): return [node]
        elif isinstance(node, list):
            for child in node: leaves.extend(self._flatten_tree_leaves(child))
        elif isinstance(node, dict):
            for children in node.values(): leaves.extend(self._flatten_tree_leaves(children))
        return leaves

    def _collect_meta_from_structure(self, node: Any, meta_dict: Dict[str, Any]):
        if isinstance(node, str):
            uid = node
            self._add_meta(uid, "leaf", meta_dict)
        elif isinstance(node, list):
            for child in node: self._collect_meta_from_structure(child, meta_dict)
        elif isinstance(node, dict):
            for uid, children in node.items():
                self._add_meta(uid, "branch", meta_dict)
                self._collect_meta_from_structure(children, meta_dict)

    def _add_meta(self, uid: str, type_default: str, meta_dict: Dict[str, Any]):
        if uid not in meta_dict:
            info = self.names_map.get(uid, {})
            meta_dict[uid] = {
                "type": info.get("type", type_default),
                "acronym": info.get("acronym", ""),
                "translated_title": info.get("translated_title", ""),
                "original_title": info.get("original_title", ""),
                "blurb": info.get("blurb")
            }

    def _write_single_book(self, group_name: str, raw_data: Dict[str, Any]) -> str:
        # 1. Structure
        raw_tree = self._load_original_tree(group_name)
        structure = self._simplify_structure(raw_tree)

        # 2. Meta
        meta_dict = {}
        self._collect_meta_from_structure(structure, meta_dict)
        
        # 3. Data: Sắp xếp & Bổ sung
        ordered_leaves = self._flatten_tree_leaves(structure)
        data_dict = {}
        
        # Add từ tree trước
        for uid in ordered_leaves:
            if uid in raw_data:
                data_dict[uid] = raw_data[uid]
        
        # Add phần còn thiếu (Quan trọng cho Extra Books)
        # Vì Extra Books có tree rỗng, nên toàn bộ data sẽ được add ở bước này
        for uid, content in raw_data.items():
            if uid not in data_dict:
                # Add vào data
                data_dict[uid] = content
                # Add vào meta (vì nó không có trong tree nên chưa được collect)
                self._add_meta(uid, "leaf", meta_dict)

        book_id = group_name.split("/")[-1]
        book_meta = self.names_map.get(book_id, {})
        
        final_output = {
            "id": book_id,
            "title": book_meta.get("translated_title", book_id.upper()),
            "structure": structure,
            "meta": meta_dict,
            "data": data_dict
        }

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
        
        logger.info(f"   💾 Saved: {file_name} ({len(data_dict)} leaves)")
        return file_name

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)