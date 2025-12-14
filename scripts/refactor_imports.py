#!/usr/bin/env python3
# Path: scripts/refactor_imports.py
import re
import os
from pathlib import Path

# Cấu hình Project Root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODULES_ROOT = PROJECT_ROOT / "web" / "assets" / "modules"

# Định nghĩa Import Map dựa trên index.html
# Key: Alias trong importmap
# Value: Tên thư mục thực tế trong assets/modules/
IMPORT_MAP = {
    "core": "core",
    "utils": "utils",
    "services": "services",
    "ui": "ui",
    "tts": "tts",
    "data": "data"
}

def resolve_import_path(current_file: Path, import_str: str) -> str:
    """
    Chuyển đổi đường dẫn import tương đối thành alias importmap nếu có thể.
    """
    # Bỏ qua các import không phải file local (vd: http, libs)
    if import_str.startswith("http") or not import_str.startswith("."):
        return import_str

    try:
        # Tính toán đường dẫn thực tế của file đích
        # resolve() sẽ xử lý ../ và ./
        target_path = (current_file.parent / import_str).resolve()
        
        # Kiểm tra xem target_path có nằm trong MODULES_ROOT không
        if not str(target_path).startswith(str(MODULES_ROOT)):
            return import_str

        # Tính đường dẫn tương đối từ modules root
        # Vd: /.../modules/core/app_config.js -> core/app_config.js
        rel_to_modules = target_path.relative_to(MODULES_ROOT)
        parts = rel_to_modules.parts
        
        if not parts:
            return import_str

        root_folder = parts[0]

        # Kiểm tra xem folder gốc có trong Import Map không
        if root_folder in IMPORT_MAP:
            # Tạo đường dẫn alias mới
            # Vd: core/app_config.js
            new_import = "/".join(parts)
            
            # [OPTION] Nếu import cùng module (vd: trong ui import ui), 
            # ta có thể giữ relative để portable, hoặc force alias.
            # Ở đây ta force alias cho sạch code, trừ khi import file cùng thư mục (./)
            # để tránh vòng lặp imports phức tạp không cần thiết.
            
            # Tuy nhiên, yêu cầu của bạn là tối ưu hóa, nên ta sẽ dùng alias
            # cho mọi thứ băng qua ranh giới thư mục hoặc đi ngược lên (../).
            if import_str.startswith("../"):
                return new_import + "" # Ensure string
            
    except Exception as e:
        # Nếu lỗi path (vd import file không tồn tại), giữ nguyên
        pass

    return import_str

def process_file(file_path: Path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex bắt import: import ... from "..."
    # Group 1: Quote mở
    # Group 2: Đường dẫn
    # Group 3: Quote đóng
    pattern = re.compile(r'(import\s+.*?from\s+)(["\'])(.*?)(["\'];?)')

    def replacement(match):
        prefix = match.group(1)
        quote = match.group(2)
        old_path = match.group(3)
        suffix = match.group(4)

        new_path = resolve_import_path(file_path, old_path)
        
        if new_path != old_path:
            print(f"   Refactoring: {old_path} -> {new_path}")
            return f"{prefix}{quote}{new_path}{suffix}"
        return match.group(0)

    new_content = pattern.sub(replacement, content)

    # Regex bắt dynamic import: import("...")
    pattern_dynamic = re.compile(r'(import\()(["\'])(.*?)(["\']\))')
    
    def replacement_dynamic(match):
        prefix = match.group(1)
        quote = match.group(2)
        old_path = match.group(3)
        suffix = match.group(4)
        new_path = resolve_import_path(file_path, old_path)
        if new_path != old_path:
             print(f"   Refactoring (Dynamic): {old_path} -> {new_path}")
             return f"{prefix}{quote}{new_path}{suffix}"
        return match.group(0)

    new_content = pattern_dynamic.sub(replacement_dynamic, new_content)

    if content != new_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    print("🚀 Starting Import Map Refactoring...")
    count = 0
    for js_file in MODULES_ROOT.rglob("*.js"):
        # Bỏ qua các file trong libs nếu có (nhưng thường libs nằm ngoài modules)
        if "libs" in js_file.parts:
            continue
            
        if process_file(js_file):
            print(f"✅ Updated: {js_file.relative_to(PROJECT_ROOT)}")
            count += 1
            
    print(f"✨ Completed. Refactored {count} files.")

if __name__ == "__main__":
    main()