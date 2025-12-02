# Path: src/sutta_processor/manager.py
import json
import logging
import os
import shutil
import re
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any
from pathlib import Path

# Import config mới
from .config import (
    OUTPUT_SUTTA_BASE, 
    OUTPUT_SUTTA_BOOKS, 
    PROCESSED_DIR,
    PROCESS_LIMIT
)
from .finder import scan_root_dir
from .converter import process_worker
from .name_parser import load_names_map 

logger = logging.getLogger("SuttaProcessor")

def natural_sort_key(s: str) -> List[Any]:
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', s)]

class SuttaManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        self.raw_collections: Dict[str, Dict[str, Any]] = {}

        # Cấu hình Output dựa trên chế độ chạy
        if self.dry_run:
            logger.info("🧪 RUNNING IN DRY-RUN MODE")
            self.output_base = PROCESSED_DIR
            self.json_indent = 2  # Prettify
        else:
            logger.info("🚀 RUNNING IN PRODUCTION MODE")
            self.output_base = OUTPUT_SUTTA_BOOKS
            self.json_indent = None # Minified

    def run(self):
        # 1. Clean up thư mục output tương ứng
        self._prepare_output_dir()

        # 2. Quét và xử lý song song (Giữ nguyên logic cũ nhưng worker sẽ trả về Dict thay vì HTML string)
        tasks = scan_root_dir(limit=PROCESS_LIMIT)
        workers = os.cpu_count() or 4
        logger.info(f"Processing {len(tasks)} items with {workers} workers...")
        
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in tasks]
            count = 0
            for future in as_completed(futures):
                group, sid, content = future.result()
                if content:
                    if group not in self.raw_collections:
                        self.raw_collections[group] = {}
                    self.raw_collections[group][sid] = content
                
                count += 1
                if count % 500 == 0:
                    logger.info(f"   Processed {count}/{len(tasks)}...")

        # 3. Ghi file kết quả
        self._write_files()
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _prepare_output_dir(self):
        """Xóa và tạo lại thư mục output."""
        if self.output_base.exists():
            shutil.rmtree(self.output_base)
        self.output_base.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Prepared output directory: {self.output_base}")

    def _write_files(self):
        logger.info("💾 Writing aggregated book files...")
        
        generated_files = []

        for group_name, raw_data in self.raw_collections.items():
            sorted_sids = sorted(raw_data.keys(), key=natural_sort_key)
            linked_data = {}
            
            for sid in sorted_sids:
                # Lấy metadata
                name_info = self.names_map.get(sid, {
                    "acronym": "",
                    "translated_title": "",
                    "original_title": ""
                })

                # Cấu trúc JSON mới (Raw Data)
                # Lưu ý: Converter.py cần trả về 'content' dạng Dict (segments)
                linked_data[sid] = {
                    "acronym": name_info["acronym"],
                    "translated_title": name_info["translated_title"],
                    "original_title": name_info["original_title"],
                    # Ở bước sau, content sẽ là Dict các segments, không phải HTML string
                    "content": raw_data[sid] 
                }

            # Tên file
            if self.dry_run:
                # Dry-run: Lưu thuần JSON để dễ đọc
                file_name = f"{group_name}.json"
                file_path = self.output_base / file_name
                # Tạo sub-folder nếu group là 'kn/dhp'
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(linked_data, f, ensure_ascii=False, indent=self.json_indent)
            
            else:
                # Production: Lưu JS Object để browser load nhanh
                file_name = f"{group_name}.js"
                file_path = self.output_base / file_name
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                json_str = json.dumps(linked_data, ensure_ascii=False, indent=self.json_indent)
                js_content = f"window.SUTTA_DB = window.SUTTA_DB || {{}}; Object.assign(window.SUTTA_DB, {json_str});"
                
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(js_content)
            
            generated_files.append(file_name)
            logger.info(f"   -> {file_name} ({len(linked_data)} items)")
        
        # Chỉ tạo loader nếu ở production mode
        if not self.dry_run:
            self._write_loader(generated_files)

    def _write_loader(self, files: list):
        # Giữ nguyên logic cũ
        files.sort()
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)