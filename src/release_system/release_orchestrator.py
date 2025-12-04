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
    build_cleanup
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process() -> None:
    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        if not js_bundler.bundle_javascript():
            raise Exception("Bundling failed")

        if not web_content_modifier.prepare_html_for_release(version_tag):
            raise Exception("HTML preparation failed")
            
        web_content_modifier.update_service_worker(version_tag)

        if zip_packager.create_zip(version_tag):
            logger.info("✨ BUILD SUCCESSFUL!")
        else:
            raise Exception("Archiving failed")
            
    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
        sys.exit(1)
        
    finally:
        build_cleanup.cleanup_artifacts()