#!/usr/bin/env python3
# Path: tools/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

# --- Configuration & Constants ---
REPO_URL = "https://github.com/suttacentral/sc-data.git"
CACHE_DIR = Path(".cache/sc_bilara_data")
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# MAPPINGS: Target 'sutta' folder specifically.
DIRECTORY_MAPPINGS: List[Tuple[str, Path]] = [
    ("sc_bilara_data/root/pli/ms/sutta", DATA_ROOT / "root"),
    ("sc_bilara_data/translation/en/sujato/sutta", DATA_ROOT / "translation"),
    ("sc_bilara_data/html/pli/ms/sutta", DATA_ROOT / "html"),
    ("sc_bilara_data/comment/en/sujato/sutta", DATA_ROOT / "comment"),
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
    """Executes a git command in the specified directory."""
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
    """Performs a fresh clone (Nuclear Option)."""
    logger.info("⚡ Performing FRESH CLONE...")
    
    # 1. Clean up old cache
    if config.cache_dir.exists():
        shutil.rmtree(config.cache_dir)
    
    config.cache_dir.mkdir(parents=True, exist_ok=True)

    # 2. Clone --no-checkout
    _run_git_command(
        config.cache_dir.parent,
        ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", config.repo_url, config.cache_dir.name]
    )

    # 3. Set Sparse-Checkout Paths
    sparse_paths = _get_sparse_paths(config)
    _run_git_command(config.cache_dir, ["sparse-checkout", "set"] + sparse_paths)

    # 4. Checkout (Try main/master)
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
    """Updates existing repo via git pull."""
    logger.info("🔄 Performing INCREMENTAL UPDATE...")
    
    # 1. Update sparse paths (in case mappings changed in code)
    sparse_paths = _get_sparse_paths(config)
    _run_git_command(config.cache_dir, ["sparse-checkout", "set"] + sparse_paths)
    
    # 2. Pull changes
    # We pull HEAD to fetch updates for whatever branch is currently checked out
    _run_git_command(config.cache_dir, ["pull", "origin", "HEAD"])
    logger.info("✅ Repository updated successfully.")

def _ensure_data_available(config: SyncConfig) -> None:
    """Orchestrates the git logic: Try Update -> Fail -> Full Clone."""
    git_dir = config.cache_dir / ".git"
    
    if git_dir.exists():
        try:
            _incremental_update(config)
            return
        except Exception as e:
            logger.warning(f"⚠️ Incremental update failed: {e}")
            logger.warning("⚠️ Falling back to fresh clone...")
    
    # Fallback or First Run
    _full_clone_setup(config)

# --- File Operations ---
def _sync_directories(config: SyncConfig) -> None:
    """Copies files from cache to destination."""
    for source_subpath, dest_path in config.mappings:
        full_source_path = config.cache_dir / source_subpath
        
        if not full_source_path.exists():
            logger.warning(f"⚠️ Source path missing: {full_source_path}")
            continue

        logger.info(f"Syncing: {source_subpath} -> {dest_path}")
        if dest_path.exists():
            shutil.rmtree(dest_path)
        shutil.copytree(full_source_path, dest_path)

# --- Orchestrator ---
def orchestrate_fetch() -> None:
    config = SyncConfig(REPO_URL, CACHE_DIR, DIRECTORY_MAPPINGS)
    logger.info("🚀 Starting Sutta Data Sync...")
    try:
        _ensure_data_available(config)
        _sync_directories(config)
        logger.info("✅ Data sync completed successfully.")
    except Exception as e:
        logger.error(f"❌ Process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    orchestrate_fetch()