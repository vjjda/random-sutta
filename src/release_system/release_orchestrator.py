# Path: src/release_system/release_orchestrator.py
import logging
import sys

from .release_config import BUILD_DIR, CRITICAL_ASSETS
from .logic import (
    release_versioning,
    asset_validator,
    build_preparer,
    js_bundler,
    web_content_modifier,
    zip_packager,
    build_cleanup,
    git_automator,
    github_publisher
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,  # [NEW]
    do_cleanup: bool = False    # [NEW] Default is False (Keep files)
) -> None:
    
    if publish_gh: enable_git = True

    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    # 1. Validate Source
    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # 2. Update Source Version
        if not web_content_modifier.update_source_version(version_tag):
            raise Exception("Failed to bump version in source.")

        # 3. Prepare Sandbox
        if not build_preparer.prepare_build_directory():
            raise Exception("Failed to create build sandbox.")

        # 4. Bundle JS
        if not js_bundler.bundle_javascript(BUILD_DIR):
            raise Exception("Bundling failed.")

        # 5. Patch HTML
        if not web_content_modifier.patch_build_html(BUILD_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 6. Create Zip
        if zip_packager.create_zip_from_build(BUILD_DIR, version_tag):
            logger.info("✨ Build Artifacts Created.")
        else:
            raise Exception("Archiving failed")

        # 7. Git & Publish Operations
        if enable_git:
            if not git_automator.commit_source_changes(version_tag):
                logger.warning("⚠️ Source commit skipped or failed.")
            
            if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                # [CHANGED] Truyền cờ is_official
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")

    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
        sys.exit(1)
        
    finally:
        # 8. Cleanup Sandbox [LOGIC MỚI]
        if do_cleanup:
            build_cleanup.remove_build_dir()
        else:
            logger.info(f"🛡️  Cleanup skipped. Build artifacts kept in: {BUILD_DIR.name}/")