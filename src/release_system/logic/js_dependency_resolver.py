# Path: src/release_system/logic/js_dependency_resolver.py
import logging
import re
from pathlib import Path
from typing import List, Set, Dict

from ..release_config import ENTRY_POINT

logger = logging.getLogger("Release.DepResolver")

def _resolve_path(base_dir: Path, current_file_rel: str, import_path: str) -> str:
    """Resolve path relative to base_dir."""
    current_path_abs = base_dir / current_file_rel
    
    # Resolve đường dẫn tuyệt đối
    target_full_path = (current_path_abs.parent / import_path).resolve()
    
    try:
        # Tính đường dẫn tương đối so với base_dir (build/dev-offline)
        rel_path = target_full_path.relative_to(base_dir.resolve())
        return str(rel_path).replace("\\", "/")
    except ValueError:
        logger.warning(f"⚠️ Import {import_path} resolves outside base dir: {target_full_path}")
        return import_path

def _scan_dependencies(base_dir: Path, file_rel: str, graph: Dict[str, Set[str]], visited: Set[str]):
    if file_rel in visited: return
    visited.add(file_rel)
    
    file_path = base_dir / file_rel
    if not file_path.exists():
        # Thử fallback thêm đuôi .js nếu thiếu
        if not file_path.name.endswith(".js"):
             file_path = file_path.with_suffix(".js")
             if not file_path.exists():
                 logger.error(f"❌ File not found: {file_rel}")
                 return
        else:
             logger.error(f"❌ File not found: {file_rel}")
             return

    if file_rel not in graph: graph[file_rel] = set()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # [FIXED] Regex bắt cả 'import' và 'export ... from'
        # Group 1: Path trong import ... from "..."
        # Group 2: Path trong export ... from "..."
        pattern = r'(?:import|export)\s+.*?from\s+[\'"](.*?)[\'"]'
        matches = re.findall(pattern, content)
        
        # Bắt thêm trường hợp import side-effect: import "./style.css"
        side_effect_pattern = r'import\s+[\'"](.*?)[\'"]'
        matches.extend(re.findall(side_effect_pattern, content))
        
        for import_path in matches:
            # Chỉ xử lý relative import (bắt đầu bằng .)
            if not import_path.startswith("."): continue
            
            resolved_child = _resolve_path(base_dir, file_rel, import_path)
            
            graph[file_rel].add(resolved_child)
            _scan_dependencies(base_dir, resolved_child, graph, visited)
            
    except Exception as e:
        logger.error(f"❌ Error scanning {file_rel}: {e}")

def _topological_sort(graph: Dict[str, Set[str]]) -> List[str]:
    sorted_list = []
    visited = set()
    temp_mark = set()

    def visit(node):
        if node in temp_mark: 
             logger.warning(f"🔄 Circular dependency detected at: {node}")
             return
        if node in visited: return
        temp_mark.add(node)
        
        # Sort dependencies để đảm bảo thứ tự determinism
        deps = sorted(list(graph.get(node, [])))
        for dep in deps: 
            visit(dep)
            
        temp_mark.remove(node)
        visited.add(node)
        sorted_list.append(node)

    # Sort keys để đảm bảo thứ tự determinism cho entry points
    for key in sorted(list(graph.keys())): 
        visit(key)
        
    return sorted_list

def resolve_bundle_order(base_dir: Path) -> List[str]:
    logger.info(f"🧠 Analyzing dependencies in {base_dir.name}...")
    graph: Dict[str, Set[str]] = {}
    visited: Set[str] = set()
    
    _scan_dependencies(base_dir, ENTRY_POINT, graph, visited)
    
    try:
        ordered = _topological_sort(graph)
        return ordered
    except ValueError as e:
        logger.error(f"❌ {e}")
        return []