# Path: src/release_system/release_orchestrator.py
import logging
import sys

# [UPDATED] Import các hằng số đường dẫn mới
from .release_config import BUILD_OFFLINE_DIR, BUILD_ONLINE_DIR, CRITICAL_ASSETS
from .logic import (
    release_versioning,
    asset_validator,
    build_preparer,
    js_bundler,
    web_content_modifier,
    zip_packager,
    git_automator,
    github_publisher,
    web_deployer
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,
    deploy_web: bool = False
) -> None:
    
    if publish_gh: enable_git = True
    
    version_tag = release_versioning.generate_version_tag()
    logger.info(f"🚀 STARTING PROCESS: {version_tag}")

    # 1. Validate Source
    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # ⚠️ BỎ BƯỚC Update Source Version vào web/
        # Thay vào đó, chúng ta sẽ tạo bản Online Build trước
        
        # ---------------------------------------------------------
        # PHASE 1: ONLINE BUILD (Dùng cho Deploy & Test ESM)
        # ---------------------------------------------------------
        if not build_preparer.prepare_build_directory(BUILD_ONLINE_DIR):
             raise Exception("Failed to prepare Online Build.")
        
        # Tiêm version vào file sw.js của bản Online
        if not web_content_modifier.inject_version_into_sw(BUILD_ONLINE_DIR, version_tag):
             raise Exception("Failed to inject version (Online).")

        # Deploy nếu được yêu cầu (Lấy nguồn từ BUILD_ONLINE_DIR)
        if deploy_web:
            if not web_deployer.deploy_web_to_ghpages(BUILD_ONLINE_DIR, version_tag):
                raise Exception("Web deployment failed.")

        # ---------------------------------------------------------
        # PHASE 2: OFFLINE BUILD (Dùng cho Zip & Artifacts)
        # ---------------------------------------------------------
        # Lưu ý: Ta copy lại từ web/ gốc để đảm bảo sạch sẽ, hoặc copy từ Online Build cũng được.
        # Nhưng copy từ web/ gốc an toàn hơn để tránh các side-effect không mong muốn.
        
        if not build_preparer.prepare_build_directory(BUILD_OFFLINE_DIR):
            raise Exception("Failed to prepare Offline Build.")

        # Tiêm version vào file sw.js của bản Offline
        if not web_content_modifier.inject_version_into_sw(BUILD_OFFLINE_DIR, version_tag):
             raise Exception("Failed to inject version (Offline).")

        # Bundle & Clean Modules (Chỉ làm cho bản Offline)
        if not js_bundler.bundle_javascript(BUILD_OFFLINE_DIR):
            raise Exception("Bundling failed.")

        # Patch HTML (Chuyển sang dùng bundle.js)
        if not web_content_modifier.patch_build_html(BUILD_OFFLINE_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # Create Zip
        if zip_packager.create_zip_from_build(BUILD_OFFLINE_DIR, version_tag):
            logger.info("✨ Offline Artifacts Created.")
        else:
            raise Exception("Archiving failed")

        # ---------------------------------------------------------
        # PHASE 3: PUBLISH (Git Tag & Release)
        # ---------------------------------------------------------
        if enable_git:
            # Lưu ý: Bây giờ ta KHÔNG commit thay đổi source code (vì sw.js giữ nguyên)
            # Trừ khi có thay đổi logic khác. 
            # Flag commit_source_changes sẽ chỉ commit nếu bạn đã sửa code thật sự trong web/.
            
            if not git_automator.commit_source_changes(version_tag):
                logger.info("ℹ️  No source changes detected (Clean Source Policy).")
            
            if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")
        
        logger.info(f"🛡️  Builds Ready:")
        logger.info(f"   👉 Online (ESM): {BUILD_ONLINE_DIR}")
        logger.info(f"   👉 Offline (Bundle): {BUILD_OFFLINE_DIR}")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)