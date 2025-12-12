# Path: src/release_system/logic/js_bundler.py
import logging
import re
import shutil
from pathlib import Path
from typing import List

from .js_dependency_resolver import resolve_bundle_order

logger = logging.getLogger("Release.JSBundler")

def _cleanup_modules(base_dir: Path) -> None:
    assets_dir = base_dir / "assets"
    modules_dir = assets_dir / "modules"
    if modules_dir.exists():
        shutil.rmtree(modules_dir)
        logger.info("   🧹 Removed source modules directory: assets/modules/")

def _process_file_content(content: str, file_name: str) -> str:
    """
    Process JS content:
    1. Remove imports and re-exports.
    2. Identify exports and create window assignments.
    3. Strip 'export' keywords.
    4. Wrap in IIFE.
    """
    
    # --- 1. REMOVE IMPORTS & RE-EXPORTS ---
    # Use re.DOTALL to handle multiline statements
    
    # Remove 'import ... from ...;' 
    content = re.sub(r'import\s+[\s\S]*?from\s+[\'"][^\'"]+[\'"];?', '', content)
    
    # Remove 'import "..."' (side-effects)
    content = re.sub(r'import\s+[\'"][^\'"]+[\'"];?', '', content)
    
    # Remove 'export ... from ...' (Barrel/Gateway files)
    content = re.sub(r'export\s+[\s\S]*?from\s+[\'"][^\'"]+[\'"];?', '', content)
    
    # --- 2. IDENTIFY EXPORTS ---
    # Detect: export const X, export function Y, export class Z
    # Capture Group 1: Name
    # (?:...) is non-capturing group
    decl_pattern = r'export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([a-zA-Z0-9_$]+)'
    
    exports = re.findall(decl_pattern, content)

    # --- 3. REMOVE 'export' KEYWORD ---
    # Replace 'export const' with 'const', etc.
    # Lookahead ensures we only remove 'export' if followed by declaration keywords
    content = re.sub(r'export\s+(?=(?:async\s+)?(?:function|class|const|let|var))', '', content)
    
    # Clean up any remaining 'export default' (not supported/used here, but safe to remove)
    content = re.sub(r'export\s+default\s+', '', content)

    # --- 4. GENERATE EXPOSE CODE ---
    expose_code = ""
    if exports:
        assignments = [f"    window.{name} = {name};" for name in exports]
        expose_code = "\n    // [Bundler] Expose exports\n" + "\n".join(assignments)
    
    # --- 5. WRAP IIFE ---
    # Only wrap if there is actual code left
    if not content.strip():
        return ""

    return (
        f"\n// --- Source: {file_name} --- \n"
        f"(() => {{\n"
        f"{content}\n"
        f"{expose_code}\n"
        f"}})();\n"
    )

def bundle_javascript(base_dir: Path) -> bool:
    file_list = resolve_bundle_order(base_dir)
    if not file_list:
        return False

    logger.info(f"🧶 Bundling {len(file_list)} files in {base_dir.name}...")
    bundle_path = base_dir / "assets" / "app.bundle.js"
    
    try:
        combined_content = ["// Bundled for Offline Use (IIFE Mode)"]
        
        for rel_path in file_list:
            file_path = base_dir / rel_path
            
            with open(file_path, "r", encoding="utf-8") as f:
                raw_content = f.read()
            
            processed_block = _process_file_content(raw_content, rel_path)
            if processed_block:
                combined_content.append(processed_block)

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: app.bundle.js")
        _cleanup_modules(base_dir)
        return True

    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        import traceback
        traceback.print_exc()
        return False