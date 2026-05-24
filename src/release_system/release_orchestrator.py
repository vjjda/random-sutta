# Path: src/release_system/release_orchestrator.py
import logging
import sys

# [UPDATED] Import hằng số mới
from .release_config import CRITICAL_ASSETS, PROJECT_ROOT
from .logic import (
    release_versioning,
    version_bumper,
    asset_validator,
    git_automator,
    github_publisher,
    artifact_packer,
    ota_packager
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,
    deploy_web: bool = False,
    create_zip: bool = False,
    package_ota: bool = False,
    update_altstore: bool = False,
    sync_altstore: bool = False,
    bump_targets: str = None,
    skip_publish: bool = False
) -> None:
    
    if is_official:
        logger.info("🌟 Mode: OFFICIAL RELEASE (Auto-enabling Git & Configs)")
        if not skip_publish:
            publish_gh = True
        update_altstore = True # Auto-enable for official

    if publish_gh: 
        enable_git = True

    # [UPDATED] Luôn dùng PROJECT_ROOT và truyền flag bump nếu bump_targets được truyền
    should_bump = bump_targets is not None
    version_tag = release_versioning.generate_version_tag(PROJECT_ROOT, bump=should_bump)
    clean_version = release_versioning.get_clean_version(PROJECT_ROOT, bump=should_bump)

    mode_label = "OFFICIAL (Latest)" if is_official else "PRE-RELEASE"
    if not publish_gh: mode_label = "LOCAL BUILD (No Publish)"
    if package_ota: mode_label = "OTA PACKAGE"
    if sync_altstore: mode_label = "ALTSTORE SYNC"

    logger.info(f"🚀 STARTING PROCESS: {version_tag} | Mode: {mode_label}")

    # [NEW] Auto-update version number selectively
    if should_bump:
        version_bumper.bump_versions(PROJECT_ROOT, clean_version, target=bump_targets)
    else:
        logger.info(f"ℹ️  Using existing version: {clean_version}")

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # =========================================================
        # PHASE 3: PUBLISH
        # =========================================================
        
        # 1. OTA Packaging
        if package_ota:
            if not ota_packager.package_lean_ota(version_tag):
                raise Exception("OTA packaging failed.")

        # [FIX] Re-insert artifact creation before Git/GH publish
        if create_zip or publish_gh:
            if not artifact_packer.create_release_artifact(version_tag):
                raise Exception("Artifact creation failed.")

        if enable_git:
             if not git_automator.commit_source_changes(version_tag):
                logger.info("ℹ️  No source changes detected.")
            
             if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")

        # =========================================================
        # PHASE 4: POST-PUBLISH SYNC (AltStore)
        # =========================================================
        # [OPTIMIZED] AltStore sync should happen AFTER GitHub release is live
        # so it can find the uploaded assets.
        if sync_altstore:
            from .logic import sync_with_github
            if not sync_with_github():
                logger.warning("⚠️ AltStore sync failed.")
            # Commit the synced altstore.json if we are in git mode
            if enable_git:
                git_automator.commit_source_changes(f"altstore sync for {version_tag}")
                git_automator.push_changes()

        elif update_altstore:
            from .logic import update_altstore_source
            if not update_altstore_source(version_tag):
                logger.warning("⚠️ AltStore source generation failed, but continuing...")
            # If we updated altstore.json locally, it was already committed in Phase 3
            # but if it was modified here, we might need another commit.
            # However, update_altstore_source usually uses version_tag info.

        # [REMOVED] Không tự động xóa lock file ở đây để Makefile có thể chạy tiếp các task khác
        logger.info(f"🛡️  Publish process finished.")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)
