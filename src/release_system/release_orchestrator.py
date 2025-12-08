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
    web_deployer
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
        # PHASE 1: ONLINE BUILD (ESM JS + Bundle CSS)
        # =========================================================
        if not build_preparer.prepare_build_directory(BUILD_ONLINE_DIR):
             raise Exception("Failed to prepare Online Build.")
        
        # 1. Inject SW Version
        if not web_content_modifier.inject_version_into_sw(BUILD_ONLINE_DIR, version_tag):
             raise Exception("Failed to inject version into SW (Online).")

        # [NEW] 2. Inject App Version (vào app.js và offline_manager.js)
        # Quan trọng để OfflineManager biết phiên bản hiện tại
        web_content_modifier.inject_version_into_app_js(BUILD_ONLINE_DIR, version_tag)
        web_content_modifier.inject_version_into_offline_manager(BUILD_ONLINE_DIR, version_tag)

        # 3. Bundle CSS
        if not css_bundler.bundle_css(BUILD_ONLINE_DIR):
            raise Exception("Online CSS Bundling failed.")

        # [NEW] 4. Patch SW Assets (Replace style.css -> style.bundle.css)
        web_content_modifier.patch_sw_style_bundle(BUILD_ONLINE_DIR)

        # 5. Patch HTML
        if not web_content_modifier.patch_online_html(BUILD_ONLINE_DIR, version_tag):
             raise Exception("Online HTML patching failed.")

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
        if not web_content_modifier.inject_version_into_sw(BUILD_OFFLINE_DIR, version_tag):
             raise Exception("Failed to inject version into SW (Offline).")

        # [NEW] 2. Inject App Version (TRƯỚC khi bundle JS)
        web_content_modifier.inject_version_into_app_js(BUILD_OFFLINE_DIR, version_tag)
        web_content_modifier.inject_version_into_offline_manager(BUILD_OFFLINE_DIR, version_tag)

        # 3. Bundle JS (Offline Only)
        if not js_bundler.bundle_javascript(BUILD_OFFLINE_DIR):
             raise Exception("JS Bundling failed.")
            
        # Patch SW Assets List (Module -> Bundle)
        if not web_content_modifier.patch_sw_assets_for_offline(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Could not patch SW asset list (Check regex)")

        # 4. Bundle CSS (Offline)
        if not css_bundler.bundle_css(BUILD_OFFLINE_DIR):
            raise Exception("Offline CSS Bundling failed.")

        # [NEW] 5. Patch SW Assets (Replace style.css -> style.bundle.css)
        # Phải gọi sau khi bundle css xong
        web_content_modifier.patch_sw_style_bundle(BUILD_OFFLINE_DIR)

        # 6. Patch HTML
        if not web_content_modifier.patch_offline_html(BUILD_OFFLINE_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 7. Offline Data Injection
        if not web_content_modifier.create_offline_index_js(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to create offline index JS")
        
        if not web_content_modifier.convert_db_json_to_js(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to convert DB JSON to JS")

        if not web_content_modifier.inject_offline_index_script(BUILD_OFFLINE_DIR):
             logger.warning("⚠️ Failed to inject offline index script")

        # Create Zip
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