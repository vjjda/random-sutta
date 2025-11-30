#!/usr/bin/env python3
# Path: tools/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

# --- Configuration & Constants ---
REPO_URL = "https://github.com/suttacentral/sc-data.git"
CACHE_DIR = Path(".cache/sc_bilara_data")
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# UPDATED MAPPINGS: Removed non-existent '/sutta' suffix.
# Mapping format: (Source in Repo, Destination in Project)
# This will fetch all collections (an, dn, mn, sn, kn, etc.) inside these folders.
DIRECTORY_MAPPINGS: List[Tuple[str, Path]] = [
    ("root/pli/ms", DATA_ROOT / "root"),
    ("translation/en/sujato", DATA_ROOT / "translation"),
    ("html/pli/ms", DATA_ROOT / "html"),
    ("comment/en/sujato", DATA_ROOT / "comment"),
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
def _run_git_command(cwd: Path, args: List[str], ignore_errors: bool = False) -> None:
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
        if ignore_errors:
            return
        logger.error(f"Git command failed: {' '.join(args)}")
        logger.error(f"Error output: {e.stderr}")
        raise RuntimeError(f"Git operation failed: {e.stderr}")

def _ensure_sparse_repo(config: SyncConfig) -> None:
    """Initializes and updates the sparse git repository."""
    
    # 1. Init Repo if missing
    if not config.cache_dir.exists():
        logger.info(f"Initializing cache directory: {config.cache_dir}")
        config.cache_dir.mkdir(parents=True, exist_ok=True)
        _run_git_command(config.cache_dir, ["init"])
        _run_git_command(config.cache_dir, ["remote", "add", "origin", config.repo_url])
    else:
        # If exists, ensure remote is correct
        _run_git_command(config.cache_dir, ["remote", "add", "origin", config.repo_url], ignore_errors=True)

    # 2. Configure Sparse Checkout
    logger.info("Configuring sparse-checkout with correct paths...")
    _run_git_command(config.cache_dir, ["config", "core.sparseCheckout", "true"])
    
    sparse_paths = [mapping[0] for mapping in config.mappings]
    sparse_file = config.cache_dir / ".git" / "info" / "sparse-checkout"
    
    sparse_file.parent.mkdir(parents=True, exist_ok=True)
    with open(sparse_file, "w") as f:
        f.write("\n".join(sparse_paths))
            
    # 3. Pull Data (Depth 1)
    logger.info("Pulling data from remote...")
    # Force pull to update the working directory based on new sparse config
    _run_git_command(config.cache_dir, ["pull", "origin", "master", "--depth", "1"])
    
    # Force checkout to ensure files are materialized
    _run_git_command(config.cache_dir, ["checkout", "master"])

# --- File Operations ---
def _sync_directories(config: SyncConfig) -> None:
    """Copies files from cache to destination."""
    for source_subpath, dest_path in config.mappings:
        full_source_path = config.cache_dir / source_subpath
        
        if not full_source_path.exists():
            logger.warning(f"⚠️ Source path still missing: {full_source_path}")
            continue

        logger.info(f"Syncing: {source_subpath} -> {dest_path}")

        # Clean destination first
        if dest_path.exists():
            shutil.rmtree(dest_path)
        
        # Copy
        shutil.copytree(full_source_path, dest_path)

# --- Orchestrator ---
def orchestrate_fetch() -> None:
    """Orchestrates the process of fetching and syncing Sutta data."""
    config = SyncConfig(
        repo_url=REPO_URL,
        cache_dir=CACHE_DIR,
        mappings=DIRECTORY_MAPPINGS
    )

    logger.info("🚀 Starting Sutta Data Sync...")
    try:
        _ensure_sparse_repo(config)
        _sync_directories(config)
        logger.info("✅ Data sync completed successfully.")
    except Exception as e:
        logger.error(f"❌ Process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    orchestrate_fetch()