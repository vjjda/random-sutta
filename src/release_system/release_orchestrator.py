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
    git_automator,
    github_publisher # [NEW]
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(enable_git: bool = False, publish_gh: bool = False) -> None:
    # Nếu muốn publish, bắt buộc phải enable git để commit code trước
    if publish_gh:
        enable_git = True

    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # ... (Các bước Build giữ nguyên) ...
        if not js_bundler.bundle_javascript(): raise Exception("Bundling failed")
        if not web_content_modifier.prepare_html_for_release(version_tag): raise Exception("HTML prep failed")
        web_content_modifier.update_service_worker(version_tag)
        
        # Tạo Zip (nhưng KHÔNG commit zip này vào git)
        if zip_packager.create_zip(version_tag):
            logger.info("✨ Build Artifacts Created.")
        else:
            raise Exception("Archiving failed")

        # --- GIT OPERATIONS ---
        if enable_git:
            # 1. Commit source changes (sw.js update...)
            if not git_automator.commit_source_changes(version_tag):
                logger.warning("⚠️ Source commit skipped or failed.")
            
            # 2. Nếu publish, phải Push code lên trước
            if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed. Cannot publish release.")
                
                # 3. Tạo GitHub Release và Upload Zip
                if not github_publisher.publish_release(version_tag):
                    raise Exception("GitHub Release failed.")

    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
        sys.exit(1)
        
    finally:
        build_cleanup.cleanup_artifacts()