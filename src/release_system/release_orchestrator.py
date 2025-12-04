# Path: src/release_system/release_orchestrator.py
import logging
import sys

from .release_config import CRITICAL_ASSETS
from .logic import (
    release_versioning,
    asset_validator,
    js_bundler,
    web_content_modifier,
    zip_packager,
    build_cleanup,
    git_automator  # [NEW] Import module mới
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(enable_git: bool = False) -> None:
    # 1. Generate Version
    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    # 2. Validation
    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # 3. Bundling
        if not js_bundler.bundle_javascript():
            raise Exception("Bundling failed")

        # 4. Content Modification
        if not web_content_modifier.prepare_html_for_release(version_tag):
            raise Exception("HTML preparation failed")
            
        web_content_modifier.update_service_worker(version_tag)

        # 5. Archiving
        if zip_packager.create_zip(version_tag):
            logger.info("✨ Build Artifacts Created.")
        else:
            raise Exception("Archiving failed")

        # 6. [NEW] Git Commit (Before Cleanup)
        if enable_git:
            if not git_automator.commit_release_artifacts(version_tag):
                logger.warning("⚠️ Git operations encountered issues.")
            
    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
        sys.exit(1)
        
    finally:
        # 7. Cleanup
        build_cleanup.cleanup_artifacts()