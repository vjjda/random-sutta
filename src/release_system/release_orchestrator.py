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
    git_automator,
    github_publisher,
    web_deployer # [NEW] Import module mới
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,
    deploy_web: bool = False # [NEW] Flag deploy
) -> None:
    
    if publish_gh: enable_git = True
    
    # Nếu deploy web thì không cần clean build offline (mặc định)
    # Nhưng nếu chỉ deploy web, ta có thể bỏ qua bước build offline để tiết kiệm thời gian
    # Tuy nhiên, để đơn giản, ta cứ chạy full luồng hoặc tách nhánh if.
    
    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING PROCESS: {version_tag}")

    # 1. Validate Source
    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # 2. Update Source Version (Luôn chạy để cả zip và web đều mới)
        if not web_content_modifier.update_source_version(version_tag):
            raise Exception("Failed to bump version in source.")

        # --- NHÁNH A: DEPLOY WEB ---
        if deploy_web:
            if not web_deployer.deploy_web_to_ghpages(version_tag):
                raise Exception("Web deployment failed.")
            # Nếu bạn chỉ muốn deploy web rồi dừng, thêm return ở đây.
            # Nếu muốn vừa deploy web vừa tạo file zip backup, để code chạy tiếp.
            
        # --- NHÁNH B: BUILD OFFLINE ZIP ---
        # Chỉ chạy build offline nếu KHÔNG phải là deploy web, 
        # hoặc nếu bạn muốn cả 2 (ở đây tôi giả định chạy cả 2 để backup)
        
        # 3. Prepare Sandbox
        if not build_preparer.prepare_build_directory():
            raise Exception("Failed to create build sandbox.")

        # 4. Bundle JS (Includes Auto-Cleanup)
        if not js_bundler.bundle_javascript(BUILD_DIR):
            raise Exception("Bundling failed.")

        # 5. Patch HTML
        if not web_content_modifier.patch_build_html(BUILD_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 6. Create Zip
        if zip_packager.create_zip_from_build(BUILD_DIR, version_tag):
            logger.info("✨ Offline Artifacts Created.")
        else:
            raise Exception("Archiving failed")

        # 7. Git & Publish (Source Code & Releases)
        if enable_git:
            if not git_automator.commit_source_changes(version_tag):
                logger.warning("⚠️ Source commit skipped or failed.")
            
            if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")
        
        logger.info(f"🛡️  Process Finished.")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)