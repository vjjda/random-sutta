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

# UPDATED MAPPINGS: Target 'sutta' folder specifically.
# Format: (Source Path in Repo, Destination Path in Project)
# Logic: Content of '.../sutta' will be copied INTO 'data/bilara/root', etc.
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

def _debug_list_files(startpath: Path):
    """Prints the directory structure for debugging purposes."""
    logger.info(f"📂 DEBUG: Listing structure of {startpath} (max depth 5):")
    for root, dirs, files in os.walk(startpath):
        level = root.replace(str(startpath), '').count(os.sep)
        # We go deeper to see if 'sutta' exists
        if level > 5: continue
        indent = ' ' * 4 * (level)
        logger.info(f"{indent}{os.path.basename(root)}/")

def _fresh_clone_sparse(config: SyncConfig) -> None:
    # 1. Clean up old cache
    if config.cache_dir.exists():
        logger.info(f"Cleaning up old cache: {config.cache_dir}")
        shutil.rmtree(config.cache_dir)
    
    config.cache_dir.mkdir(parents=True, exist_ok=True)

    # 2. Clone --no-checkout
    logger.info("Initializing repo (Clone --no-checkout)...")
    _run_git_command(
        config.cache_dir.parent,
        ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", config.repo_url, config.cache_dir.name]
    )

    # 3. Set Sparse-Checkout Paths
    sparse_paths = [mapping[0].strip("/") for mapping in config.mappings]
    logger.info(f"Setting sparse paths: {sparse_paths}")
    
    _run_git_command(config.cache_dir, ["sparse-checkout", "set"] + sparse_paths)

    # 4. Checkout (Try main/master)
    logger.info("Downloading files (Checkout)...")
    branches = ["main", "master"]
    checked_out = False
    for branch in branches:
        try:
            _run_git_command(config.cache_dir, ["checkout", branch])
            logger.info(f"✅ Successfully checked out '{branch}'.")
            checked_out = True
            break
        except RuntimeError:
            continue
    
    if not checked_out:
        raise RuntimeError("Could not checkout 'main' or 'master'.")

    # DEBUG: Show what we actually got
    _debug_list_files(config.cache_dir)

# --- File Operations ---
def _sync_directories(config: SyncConfig) -> None:
    """Copies files from cache to destination."""
    for source_subpath, dest_path in config.mappings:
        full_source_path = config.cache_dir / source_subpath
        
        if not full_source_path.exists():
            logger.warning(f"⚠️ Source path not found: {full_source_path}")
            continue

        logger.info(f"Syncing: {source_subpath} -> {dest_path}")
        if dest_path.exists():
            shutil.rmtree(dest_path)
        
        # Copytree will create the folder 'dest_path' and fill it with contents of 'full_source_path'
        shutil.copytree(full_source_path, dest_path)

# --- Orchestrator ---
def orchestrate_fetch() -> None:
    config = SyncConfig(REPO_URL, CACHE_DIR, DIRECTORY_MAPPINGS)
    logger.info("🚀 Starting Sutta Data Sync (Filtered for Sutta Only)...")
    try:
        _fresh_clone_sparse(config)
        _sync_directories(config)
        logger.info("✅ Data sync completed successfully.")
    except Exception as e:
        logger.error(f"❌ Process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    orchestrate_fetch()