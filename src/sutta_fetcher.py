#!/usr/bin/env python3
# Path: src/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration & Constants ---
REPO_URL = "https://github.com/suttacentral/sc-data.git"
CACHE_DIR = Path(".cache/sc_bilara_data")
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# MAPPINGS
# Format: (Source Path inside Repo, Destination Path in Local Project)
DIRECTORY_MAPPINGS: List[Tuple[str, Path]] = [
    ("sc_bilara_data/root/pli/ms/sutta", DATA_ROOT / "root"),
    ("sc_bilara_data/translation/en/sujato/sutta", DATA_ROOT / "translation"),
    ("sc_bilara_data/html/pli/ms/sutta", DATA_ROOT / "html"),
    ("sc_bilara_data/comment/en/sujato/sutta", DATA_ROOT / "comment"),
    # NEW: Fetch Sutta Names
    ("sc_bilara_data/translation/en/sujato/name/sutta", DATA_ROOT / "name"),
]

# --- Internal Types ---
@dataclass
class SyncConfig:
    repo_url: str
    cache_dir: Path
    mappings: List[Tuple[str, Path]]

# --- Logging Setup ---
def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("SuttaFetcher")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger

logger = _setup_logger()

# --- Git Operations ---
def _run_git_command(cwd: Path, args: List[str]) -> None:
    try:
        subprocess.run(
            ["git"] + args,
            cwd=cwd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Git command '{' '.join(args)}' failed: {e.stderr.strip()}")

def _get_sparse_paths(config: SyncConfig) -> List[str]:
    return [mapping[0].strip("/") for mapping in config.mappings]

def _full_clone_setup(config: SyncConfig) -> None:
    logger.info("⚡ Performing FRESH CLONE...")
    if config.cache_dir.exists():
        shutil.rmtree(config.cache_dir)
    config.cache_dir.mkdir(parents=True, exist_ok=True)

    _run_git_command(
        config.cache_dir.parent,
        ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", config.repo_url, config.cache_dir.name]
    )

    sparse_paths = _get_sparse_paths(config)
    _run_git_command(config.cache_dir, ["sparse-checkout", "set"] + sparse_paths)

    branches = ["main", "master"]
    checked_out = False
    for branch in branches:
        try:
            _run_git_command(config.cache_dir, ["checkout", branch])
            logger.info(f"✅ Checked out '{branch}'.")
            checked_out = True
            break
        except RuntimeError:
            continue
    
    if not checked_out:
        raise RuntimeError("Could not checkout 'main' or 'master'.")

def _incremental_update(config: SyncConfig) -> None:
    logger.info("🔄 Performing INCREMENTAL UPDATE...")
    # Update sparse-checkout definition to include new paths (like 'name/sutta')
    sparse_paths = _get_sparse_paths(config)
    _run_git_command(config.cache_dir, ["sparse-checkout", "set"] + sparse_paths)
    
    # Pull latest changes
    _run_git_command(config.cache_dir, ["pull", "origin", "HEAD"])
    logger.info("✅ Repository updated successfully.")

def _ensure_data_available(config: SyncConfig) -> None:
    git_dir = config.cache_dir / ".git"
    if git_dir.exists():
        try:
            _incremental_update(config)
            return
        except Exception as e:
            logger.warning(f"⚠️ Incremental update failed: {e}")
            logger.warning("⚠️ Falling back to fresh clone...")
    _full_clone_setup(config)

# --- Multithreaded File Operations ---
def _copy_worker(mapping: Tuple[str, Path], cache_dir: Path) -> str:
    """Worker function for threading."""
    source_subpath, dest_path = mapping
    full_source_path = cache_dir / source_subpath
    
    if not full_source_path.exists():
        return f"⚠️ Missing: {source_subpath}"

    if dest_path.exists():
        shutil.rmtree(dest_path)
    
    shutil.copytree(full_source_path, dest_path)
    return f"✅ Synced: {dest_path.name}"

def _sync_directories_parallel(config: SyncConfig) -> None:
    """Copies files using ThreadPoolExecutor."""
    logger.info(f"🔄 Syncing directories with {os.cpu_count()} threads...")
    
    with ThreadPoolExecutor() as executor:
        # Submit all copy tasks
        futures = {
            executor.submit(_copy_worker, mapping, config.cache_dir): mapping 
            for mapping in config.mappings
        }
        
        for future in as_completed(futures):
            try:
                result = future.result()
                logger.info(result)
            except Exception as e:
                logger.error(f"❌ Thread error: {e}")
                raise

# --- Orchestrator ---
def orchestrate_fetch() -> None:
    config = SyncConfig(REPO_URL, CACHE_DIR, DIRECTORY_MAPPINGS)
    logger.info("🚀 Starting Sutta Data Sync...")
    try:
        _ensure_data_available(config)
        _sync_directories_parallel(config)
        logger.info("✅ All operations completed successfully.")
    except Exception as e:
        logger.error(f"❌ Process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    orchestrate_fetch()