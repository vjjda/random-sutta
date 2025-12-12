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
    
    # Resolve absolute path
    target_full_path = (current_path_abs.parent / import_path).resolve()
    
    try:
        # Calculate relative path from base_dir (build/dev-offline)
        rel_path = target_full_path.relative_to(base_dir.resolve())
        return str(rel_path).replace("\\", "/")
    except ValueError:
        logger.warning(f"⚠️ Import {import_path} resolves outside base dir: {target_full_path}")
        return import_path

def _scan_dependencies(base_dir: Path, file_rel: str, graph: Dict[str, Set[str]], visited: Set[str]):
    if file_rel in visited: return
    visited.add(file_rel)
    
    file_path = base_dir / file_rel
    
    # Fallback to .js extension if file not found
    if not file_path.exists():
        if not file_path.name.endswith(".js"):
             file_path = file_path.with_suffix(".js")
    
    if not file_path.exists():
        logger.error(f"❌ File not found: {file_rel}")
        return

    if file_rel not in graph: graph[file_rel] = set()

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # [FIXED] Robust Regex to capture paths from:
        # 1. import ... from "path"
        # 2. export ... from "path"
        # 3. import "path" (side-effects)
        
        # Use simpler regexes to catch the 'from "path"' part or 'import "path"'
        patterns = [
            r'from\s+[\'"]([^\'"]+)[\'"]',      # Matches 'from "./file.js"'
            r'import\s+[\'"]([^\'"]+)[\'"]'     # Matches 'import "./file.js"'
        ]
        
        found_paths = set()
        for pat in patterns:
            found_paths.update(re.findall(pat, content))
        
        for import_path in found_paths:
            # Only process relative imports
            if not import_path.startswith("."): continue
            
            resolved_child = _resolve_path(base_dir, file_rel, import_path)
            
            # Ensure .js extension for resolution key
            if not resolved_child.endswith(".js"):
                 child_path_obj = base_dir / resolved_child
                 # Check if adding .js helps finding the file
                 if not child_path_obj.exists() and (child_path_obj.parent / f"{child_path_obj.name}.js").exists():
                     resolved_child += ".js"

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
             # Circular dependency detected, but we continue to generate partial bundle
             return
        if node in visited: return
        temp_mark.add(node)
        
        # Sort dependencies to ensure deterministic order
        deps = sorted(list(graph.get(node, [])))
        for dep in deps: 
            visit(dep)
            
        temp_mark.remove(node)
        visited.add(node)
        sorted_list.append(node)

    # Sort keys for deterministic entry point processing
    keys = sorted(list(graph.keys()))
    for key in keys: visit(key)
    
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