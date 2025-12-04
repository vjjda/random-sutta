# Path: src/release_system/orchestrator.py
import logging
import sys

from .config import CRITICAL_ASSETS
from .logic import (
    versioning,
    validator,
    bundler,
    content_modifier,
    archiver,
    cleaner
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process() -> None:
    # 1. Generate Version (Timestamp with Seconds)
    version_tag = versioning.generate_version_tag()
    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    # 2. Validation (Basic checks)
    if not validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # 3. Bundling (Auto-resolve dependencies inside)
        if not bundler.bundle_javascript(): # [CHANGED] Không truyền tham số
            raise Exception("Bundling failed")

        # 4. Content Modification
        if not content_modifier.prepare_html_for_release(version_tag):
            raise Exception("HTML preparation failed")
            
        content_modifier.update_service_worker(version_tag)

        # 5. Archiving
        if archiver.create_zip(version_tag):
            logger.info("✨ BUILD SUCCESSFUL!")
        else:
            raise Exception("Archiving failed")
            
    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
        sys.exit(1)
        
    finally:
        # 6. Cleanup (Always run)
        cleaner.cleanup_artifacts()