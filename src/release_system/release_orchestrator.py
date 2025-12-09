# Path: src/release_system/release_orchestrator.py
import logging
import sys

from .release_config import BUILD_OFFLINE_DIR, BUILD_ONLINE_DIR, CRITICAL_ASSETS
from .logic import (
    release_versioning,
    asset_validator,
    build_preparer,
    js_bundler,
    css_bundler,
    web_content_modifier,
    zip_packager,
    git_automator,
    github_publisher,
    web_deployer,
    version_injector,
    html_patcher,
    sw_patcher,
    offline_converter
)

logger = logging.getLogger("Release.Orchestrator")

def run_release_process(
    enable_git: bool = False, 
    publish_gh: bool = False,
    is_official: bool = False,
    deploy_web: bool = False,
    create_zip: bool = False 
) -> None:
    
    if is_official:
        logger.info("🌟 Mode: OFFICIAL RELEASE (Auto-enabling Publish, Git & Zip)")
        publish_gh = True

    if publish_gh: 
        enable_git = True
        create_zip = True 

    version_tag = release_versioning.generate_version_tag()
    
    mode_label = "OFFICIAL (Latest)" if is_official else "PRE-RELEASE"
    if not publish_gh: mode_label = "LOCAL BUILD (No Publish)"

    logger.info(f"🚀 STARTING PROCESS: {version_tag} | Mode: {mode_label}")

    if not asset_validator.check_critical_assets(CRITICAL_ASSETS):
        sys.exit(1)

    try:
        # =========================================================
        # PHASE 1: ONLINE BUILD
        # =========================================================
        if not build_preparer.prepare_build_directory(BUILD_ONLINE_DIR):
             raise Exception("Failed to prepare Online Build.")
        
        # 1. Inject SW Version
        if not version_injector.inject_version_into_sw(BUILD_ONLINE_DIR, version_tag):
             raise Exception("Failed to inject version into SW (Online).")

        # [NEW] 2. Inject App Version (vào app.js và offline_manager.js)
        # Quan trọng để OfflineManager biết phiên bản hiện tại
        version_injector.inject_version_into_app_js(BUILD_ONLINE_DIR, version_tag)
        version_injector.inject_version_into_offline_manager(BUILD_ONLINE_DIR, version_tag)

        # 3. Bundle CSS
        if not css_bundler.bundle_css(BUILD_ONLINE_DIR):
            raise Exception("Online CSS Bundling failed.")

        # [NEW] 4. Patch SW Assets (Replace style.css -> style.bundle.css)
        sw_patcher.patch_sw_style_bundle(BUILD_ONLINE_DIR)
        
        # [NEW] 4b. Inject all JS modules for Online (Unbundled) Offline capability
        sw_patcher.patch_online_assets(BUILD_ONLINE_DIR)

        # 5. Patch HTML
        if not html_patcher.patch_online_html(BUILD_ONLINE_DIR, version_tag):
             raise Exception("Online HTML patching failed.")

        # [NEW] 6. Cleanup Redundant Index
        web_content_modifier.remove_monolithic_index(BUILD_ONLINE_DIR)

        # [NEW] 7. Create DB Bundle Zip (for Offline Download feature)
        if not zip_packager.create_db_bundle(BUILD_ONLINE_DIR):
             logger.warning("⚠️ Failed to create DB bundle zip (Offline download may fail).")

        # Deploy
        if deploy_web:
            if not web_deployer.deploy_web_to_ghpages(BUILD_ONLINE_DIR, version_tag):
                raise Exception("Web deployment failed.")

        # =========================================================
        # PHASE 2: OFFLINE BUILD (Bundle JS + Bundle CSS)
        # =========================================================
        if not build_preparer.prepare_build_directory(BUILD_OFFLINE_DIR):
            raise Exception("Failed to prepare Offline Build.")

        # 1. Inject SW Version
        if not version_injector.inject_version_into_sw(BUILD_OFFLINE_DIR, version_tag):
             raise Exception("Failed to inject version into SW (Offline).")

        # 2. Inject App Version
        version_injector.inject_version_into_app_js(BUILD_OFFLINE_DIR, version_tag)
        version_injector.inject_version_into_offline_manager(BUILD_OFFLINE_DIR, version_tag)

        # 3. Bundle JS
        if not js_bundler.bundle_javascript(BUILD_OFFLINE_DIR):
             raise Exception("JS Bundling failed.")
            
        if not sw_patcher.patch_sw_assets_for_offline(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Could not patch SW asset list")

        # 4. Bundle CSS
        if not css_bundler.bundle_css(BUILD_OFFLINE_DIR):
            raise Exception("Offline CSS Bundling failed.")

        # 5. Patch SW Style
        sw_patcher.patch_sw_style_bundle(BUILD_OFFLINE_DIR)

        # 6. Patch HTML
        if not html_patcher.patch_offline_html(BUILD_OFFLINE_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 7. Offline Data Injection
        if not offline_converter.create_offline_index_js(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to create offline index JS")
        
        if not offline_converter.convert_db_json_to_js(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to convert DB JSON to JS")

        if not html_patcher.inject_offline_index_script(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to inject offline index script")

        # [NEW] 8. Remove redundant Zip
        # Bản Offline không dùng tính năng "Download All" (vì đã có sẵn data), nên xóa zip đi cho nhẹ
        web_content_modifier.remove_db_bundle(BUILD_OFFLINE_DIR)
        
        # [NEW] 9. Remove redundant Index directory
        # Bản Offline dùng db_index.js, không cần folder index/
        web_content_modifier.remove_redundant_index(BUILD_OFFLINE_DIR)

        # Create Zip Artifact (Final Output)
        if create_zip:
            if zip_packager.create_zip_from_build(BUILD_OFFLINE_DIR, version_tag):
                 logger.info("✨ Offline Artifacts Created.")
            else:
                raise Exception("Archiving failed")
        else:
            logger.info("⏩ Skipped Zip packaging.")

        # =========================================================
        # PHASE 3: PUBLISH
        # =========================================================
        if enable_git:
             if not git_automator.commit_source_changes(version_tag):
                logger.info("ℹ️  No source changes detected.")
            
             if publish_gh:
                if not git_automator.push_changes():
                    raise Exception("Git Push failed.")
                
                if not github_publisher.publish_release(version_tag, is_official):
                    raise Exception("GitHub Release failed.")
        
        logger.info(f"🛡️  Builds Ready:")
        logger.info(f"   👉 Online (ESM + CSS Bundle): {BUILD_ONLINE_DIR}")
        logger.info(f"   👉 Offline (Full Bundle): {BUILD_OFFLINE_DIR}")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)