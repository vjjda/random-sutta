# Path: src/release_system/logic/dependency_resolver.py
import logging
import re
from pathlib import Path
from typing import List, Set, Dict

from ..config import WEB_DIR, ENTRY_POINT

logger = logging.getLogger("Release.DepResolver")

def _resolve_path(current_file_rel: str, import_path: str) -> str:
    # ... (Giữ nguyên hàm này)
    current_path = WEB_DIR / current_file_rel
    target_full_path = (current_path.parent / import_path).resolve()
    try:
        return str(target_full_path.relative_to(WEB_DIR)).replace("\\", "/")
    except ValueError:
        logger.warning(f"⚠️ Import {import_path} in {current_file_rel} is outside web dir.")
        return import_path

def _scan_dependencies(file_rel: str, graph: Dict[str, Set[str]], visited: Set[str]):
    # ... (Giữ nguyên hàm này)
    if file_rel in visited:
        return
    visited.add(file_rel)
    
    file_path = WEB_DIR / file_rel
    if not file_path.exists():
        logger.error(f"❌ File not found: {file_rel}")
        return

    if file_rel not in graph:
        graph[file_rel] = set()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        pattern = r"import\s+.*?from\s+['\"](.*?)['\"]"
        matches = re.findall(pattern, content)
        
        for import_path in matches:
            if not import_path.startswith("."): 
                continue
            resolved_child = _resolve_path(file_rel, import_path)
            graph[file_rel].add(resolved_child)
            _scan_dependencies(resolved_child, graph, visited)
            
    except Exception as e:
        logger.error(f"❌ Error scanning {file_rel}: {e}")

def _topological_sort(graph: Dict[str, Set[str]]) -> List[str]:
    # ... (Giữ nguyên hàm này)
    sorted_list = []
    visited = set()
    temp_mark = set()

    def visit(node):
        if node in temp_mark:
            raise ValueError(f"🔄 Circular dependency detected involving {node}")
        if node in visited:
            return
        temp_mark.add(node)
        dependencies = graph.get(node, [])
        for dep in dependencies:
            visit(dep)
        temp_mark.remove(node)
        visited.add(node)
        sorted_list.append(node)

    keys = list(graph.keys())
    for key in keys:
        visit(key)
        
    return sorted_list

def resolve_bundle_order() -> List[str]:
    """Hàm chính để tính toán thứ tự file."""
    logger.info(f"🧠 Analyzing dependencies starting from: {ENTRY_POINT}...")
    
    dependency_graph: Dict[str, Set[str]] = {}
    visited_files: Set[str] = set()
    
    # 1. Build Graph
    _scan_dependencies(ENTRY_POINT, dependency_graph, visited_files)
    
    # 2. Sort
    try:
        ordered_files = _topological_sort(dependency_graph)
        
        # [NEW] In ra danh sách thứ tự để kiểm tra
        logger.info(f"   ✅ Auto-resolved {len(ordered_files)} files. Bundle Order:")
        logger.info("   " + "="*50)
        for i, f in enumerate(ordered_files):
            # Format: 01. assets/modules/utils.js
            logger.info(f"   {i+1:02d}. {f}")
        logger.info("   " + "="*50)
        
        return ordered_files
    except ValueError as e:
        logger.error(f"❌ {e}")
        return []