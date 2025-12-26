# Path: src/release_system/logic/js_dependency_resolver.py
import logging
import re
from pathlib import Path
from typing import List, Set, Dict

from ..release_config import ENTRY_POINT

logger = logging.getLogger("Release.DepResolver")

# [NEW] Định nghĩa Import Map tương đương với index.html
# Key: Alias
# Value: Đường dẫn tương đối từ thư mục gốc (build/dev-offline) tới module
IMPORT_MAP_ALIASES = {
    "core": "assets/modules/core",
    "utils": "assets/modules/utils",
    "services": "assets/modules/services",
    "ui": "assets/modules/ui",
    "tts": "assets/modules/tts",
    "data": "assets/modules/data",
    "lookup": "assets/modules/lookup",
    "wa-sqlite": "assets/libs"
}

def _resolve_path(base_dir: Path, current_file_rel: str, import_path: str) -> str:
    """Resolve path relative to base_dir, handling both relative imports and Import Maps."""
    
    # [NEW] 1. Xử lý Import Map Aliases
    for alias, map_dir in IMPORT_MAP_ALIASES.items():
        # Kiểm tra xem import_path có bắt đầu bằng alias không (vd: "utils/logger.js")
        if import_path.startswith(f"{alias}/"):
            # Tách phần đuôi: "utils/logger.js" -> "logger.js"
            remainder = import_path[len(alias)+1:]
            # Ghép thành đường dẫn thực: "assets/modules/utils/logger.js"
            resolved_rel = f"{map_dir}/{remainder}"
            return resolved_rel.replace("\\", "/")

    # 2. Xử lý Relative Imports (Logic cũ)
    if import_path.startswith("."):
        current_path_abs = base_dir / current_file_rel
        target_full_path = (current_path_abs.parent / import_path).resolve()
        
        try:
            rel_path = target_full_path.relative_to(base_dir.resolve())
            return str(rel_path).replace("\\", "/")
        except ValueError:
            logger.warning(f"⚠️ Import {import_path} resolves outside base dir: {target_full_path}")
            return import_path

    # Nếu không khớp cái nào, trả về nguyên gốc (có thể là lib ngoài)
    return import_path

def _scan_dependencies(base_dir: Path, file_rel: str, graph: Dict[str, Set[str]], visited: Set[str]):
    if file_rel in visited: return
    visited.add(file_rel)
    
    file_path = base_dir / file_rel
    
    # Fallback to .js extension if file not found
    if not file_path.exists():
        if not file_path.name.endswith(".js"):
             file_path = file_path.with_suffix(".js")
             # Cập nhật lại key file_rel để graph chính xác
             file_rel = str(file_path.relative_to(base_dir)).replace("\\", "/")
    
    if not file_path.exists():
        logger.error(f"❌ File not found: {file_rel} (Base: {base_dir})")
        return

    if file_rel not in graph: graph[file_rel] = set()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # [FIX] Remove comments to avoid false positives (e.g., "from 'en-US'" in comments)
        # Remove /* ... */
        content = re.sub(r'/\*[\s\S]*?\*/', '', content)
        # Remove // ...
        content = re.sub(r'//.*', '', content)
            
        # Regex to capture paths
        patterns = [
            r'from\s+[\'"]([^\'"]+)[\'"]',      # Matches 'from "path"'
            r'import\s+[\'"]([^\'"]+)[\'"]',    # Matches 'import "path"'
            r'import\([\'"]([^\'"]+)[\'"]\)'    # Matches dynamic 'import("path")'
        ]
        
        found_paths = set()
        for pat in patterns:
            found_paths.update(re.findall(pat, content))
        
        for import_path in found_paths:
            # [UPDATED] Không còn filter startswith('.') nữa vì ta hỗ trợ cả Alias
            
            resolved_child = _resolve_path(base_dir, file_rel, import_path)
            
            # Ensure .js extension for resolution key
            if not resolved_child.endswith(".js"):
                 child_path_obj = base_dir / resolved_child
                 # Check if adding .js helps finding the file
                 if not child_path_obj.exists() and (child_path_obj.parent / f"{child_path_obj.name}.js").exists():
                     resolved_child += ".js"

            # Avoid self-reference
            if resolved_child == file_rel:
                continue

            graph[file_rel].add(resolved_child)
            _scan_dependencies(base_dir, resolved_child, graph, visited)
            
    except Exception as e:
        logger.error(f"❌ Error scanning {file_rel}: {e}")

def _topological_sort(graph: Dict[str, Set[str]]) -> List[str]:
    # ... (Giữ nguyên logic topological sort cũ) ...
    sorted_list = []
    visited = set()
    temp_mark = set()

    def visit(node):
        if node in temp_mark: return # Cycle detected
        if node in visited: return
        temp_mark.add(node)
        
        deps = sorted(list(graph.get(node, [])))
        for dep in deps: 
            visit(dep)
            
        temp_mark.remove(node)
        visited.add(node)
        sorted_list.append(node)

    keys = sorted(list(graph.keys()))
    for key in keys: visit(key)
    
    return sorted_list

def resolve_bundle_order(base_dir: Path) -> List[str]:
    logger.info(f"🧠 Analyzing dependencies (with Import Maps) in {base_dir.name}...")
    graph: Dict[str, Set[str]] = {}
    visited: Set[str] = set()
    
    _scan_dependencies(base_dir, ENTRY_POINT, graph, visited)
    
    try:
        ordered = _topological_sort(graph)
        return ordered
    except ValueError as e:
        logger.error(f"❌ {e}")
        return []