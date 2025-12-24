# Path: src/data_fetcher/bilara/vcs/git_wrapper.py
import logging
import shutil
import subprocess
from pathlib import Path
from typing import List

from ..config import CACHE_DIR, REPO_URL, BRANCH_NAME, FETCH_MAPPING

logger = logging.getLogger("DataFetcher.Bilara.VCS")

class GitWrapper:
    def _run_git(self, cwd: Path, args: List[str]) -> None:
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
            raise RuntimeError(f"Git command failed: {' '.join(args)}\nError: {e.stderr.strip()}")

    def _configure_sparse_checkout(self) -> None:
        self._run_git(CACHE_DIR, ["config", "core.sparseCheckout", "true"])
        sparse_path = CACHE_DIR / ".git" / "info" / "sparse-checkout"
        sparse_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(sparse_path, "w") as f:
            for path in FETCH_MAPPING.keys():
                f.write(path.strip("/") + "\n")

    def _perform_fresh_clone(self) -> None:
        logger.info("   📥 Cloning fresh repository...")
        if CACHE_DIR.exists():
            shutil.rmtree(CACHE_DIR)
        
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._run_git(CACHE_DIR, ["init"])
        self._run_git(CACHE_DIR, ["remote", "add", "origin", REPO_URL])
        
        self._configure_sparse_checkout()
        
        logger.info(f"   📥 Fetching {BRANCH_NAME}...")
        self._run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
        
        logger.info("   🔨 Resetting to match remote...")
        self._run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])

    def _update_existing(self) -> None:
        if not (CACHE_DIR / ".git").exists():
            raise RuntimeError("Invalid git repository")
            
        logger.info(f"   🔄 Updating existing repository (Target: {BRANCH_NAME})...")
        self._configure_sparse_checkout()
        self._run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
        self._run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])
        self._run_git(CACHE_DIR, ["clean", "-fdx"])

    def sync_repo(self) -> None:
        logger.info("⚡ Setting up data repository...")
        if CACHE_DIR.exists():
            try:
                self._update_existing()
                logger.info("✅ Repository updated.")
                return
            except Exception as e:
                logger.warning(f"⚠️ Update failed ({e}). Re-cloning...")
        
        try:
            self._perform_fresh_clone()
            logger.info("✅ Repository synced successfully.")
        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            raise e