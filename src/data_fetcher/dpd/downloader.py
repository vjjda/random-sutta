# Path: src/data_fetcher/dpd/downloader.py
import json
import urllib.request
import urllib.error
import tarfile
import shutil
from pathlib import Path
from typing import Optional, Dict, Any

from src.logging_config import setup_logging
from ..fetcher_config import DpdConfig

logger = setup_logging("DataFetcher.DPD")

class DpdDownloader:
    def __init__(self):
        self.headers = {
            "User-Agent": "RandomSutta/1.0 (Python Metadata Fetcher)"
        }

    def _get_local_version(self) -> Optional[str]:
        if DpdConfig.VERSION_FILE.exists():
            try:
                return DpdConfig.VERSION_FILE.read_text().strip()
            except Exception:
                return None
        return None

    def _get_remote_release_info(self) -> Dict[str, Any]:
        """Fetch latest release info from GitHub API."""
        try:
            req = urllib.request.Request(DpdConfig.GITHUB_API_LATEST, headers=self.headers)
            with urllib.request.urlopen(req) as response:
                if response.status != 200:
                    raise RuntimeError(f"GitHub API Error: {response.status}")
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            logger.error(f"❌ Failed to check for updates: {e}")
            raise e

    def _find_asset_url(self, release_data: Dict[str, Any]) -> Optional[str]:
        for asset in release_data.get("assets", []):
            if asset["name"] == DpdConfig.ASSET_NAME:
                return asset["browser_download_url"]
        return None

    def _download_and_extract(self, url: str, tag: str) -> None:
        logger.info(f"   ⬇️  Downloading {DpdConfig.ASSET_NAME}...")
        
        # Ensure directory exists (Don't wipe it!)
        DpdConfig.DATA_DIR.mkdir(parents=True, exist_ok=True)

        temp_tar_path = DpdConfig.DATA_DIR / "temp_dpd.tar.bz2"

        try:
            # 1. Download
            with urllib.request.urlopen(url) as response, open(temp_tar_path, 'wb') as out_file:
                shutil.copyfileobj(response, out_file)
            
            logger.info("   📦 Extracting archive...")
            
            # 2. Extract (Overwrite existing files)
            with tarfile.open(temp_tar_path, "r:bz2") as tar:
                # Security warning: tarfile.extractall is unsafe for untrusted archives, 
                # but we trust DPD official release.
                tar.extractall(path=DpdConfig.DATA_DIR)
            
            # 3. Cleanup & Versioning
            temp_tar_path.unlink()
            DpdConfig.VERSION_FILE.write_text(tag)
            
            logger.info(f"✅ Successfully installed DPD version: {tag}")

        except Exception as e:
            logger.error(f"❌ Error during download/extraction: {e}")
            if temp_tar_path.exists():
                temp_tar_path.unlink()
            raise e

    def run(self) -> None:
        logger.info("🚀 Checking for DPD updates...")
        
        try:
            remote_info = self._get_remote_release_info()
            remote_tag = remote_info["tag_name"]
            download_url = self._find_asset_url(remote_info)

            if not download_url:
                logger.error(f"❌ Asset {DpdConfig.ASSET_NAME} not found in release {remote_tag}")
                return

            local_tag = self._get_local_version()

            if local_tag == remote_tag:
                logger.info(f"✅ DPD is up to date ({local_tag}). Skipping.")
                return

            if local_tag:
                logger.info(f"   🔄 New version found: {remote_tag} (Current: {local_tag})")
            else:
                logger.info(f"   🆕 Installing fresh version: {remote_tag}")

            self._download_and_extract(download_url, remote_tag)

        except Exception:
            # Logging already handled in sub-methods
            pass

def run_dpd_fetch() -> None:
    downloader = DpdDownloader()
    downloader.run()