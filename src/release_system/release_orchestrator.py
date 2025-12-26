# Path: src/release_system/release_orchestrator.py
import logging
import sys

# [UPDATED] Import hằng số mới
from .release_config import BUILD_SERVERLESS_DIR, BUILD_PWA_DIR, CRITICAL_ASSETS
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
        # PHASE 1: PWA BUILD (Standard Web / HTTP Server)
        # =========================================================
        if not build_preparer.prepare_build_directory(BUILD_PWA_DIR):
             raise Exception("Failed to prepare PWA Build.")
        
        # 1. Inject SW Version
        if not version_injector.inject_version_into_sw(BUILD_PWA_DIR, version_tag):
             raise Exception("Failed to inject version into SW (PWA).")

        # 2. Inject App Version
        version_injector.inject_version_into_app_js(BUILD_PWA_DIR, version_tag)
        version_injector.inject_version_into_offline_manager(BUILD_PWA_DIR, version_tag)

        # 3. Bundle CSS
        if not css_bundler.bundle_css(BUILD_PWA_DIR):
            raise Exception("PWA CSS Bundling failed.")

        # 4. Patch SW Assets
        sw_patcher.patch_sw_style_bundle(BUILD_PWA_DIR)
        sw_patcher.patch_online_assets(BUILD_PWA_DIR)

        # 5. Patch HTML
        if not html_patcher.patch_online_html(BUILD_PWA_DIR, version_tag):
             raise Exception("PWA HTML patching failed.")

        # 6. Cleanup & Zip
        web_content_modifier.remove_monolithic_index(BUILD_PWA_DIR)
        if not zip_packager.create_db_bundle(BUILD_PWA_DIR):
             logger.warning("⚠️ Failed to create DB bundle zip.")
        
        # [NEW] Create DPD DB Zip for Offline Cache
        if not zip_packager.create_dpd_db_zip(BUILD_PWA_DIR):
             logger.warning("⚠️ Failed to create DPD DB zip.")

        # [NEW] Remove raw dictionary files to reduce deployment size (bypass GitHub 100MB limit)
        web_content_modifier.remove_raw_dictionary_files(BUILD_PWA_DIR)

        # Deploy (PWA Build goes to GH Pages)
        if deploy_web:
            if not web_deployer.deploy_web_to_ghpages(BUILD_PWA_DIR, version_tag):
                raise Exception("Web deployment failed.")

        # =========================================================
        # PHASE 2: SERVERLESS BUILD (Standalone / file://)
        # =========================================================
        if not build_preparer.prepare_build_directory(BUILD_SERVERLESS_DIR):
            raise Exception("Failed to prepare Serverless Build.")

        # 1. Inject SW Version
        if not version_injector.inject_version_into_sw(BUILD_SERVERLESS_DIR, version_tag):
             raise Exception("Failed to inject version into SW (Serverless).")

        # 2. Inject App Version
        version_injector.inject_version_into_app_js(BUILD_SERVERLESS_DIR, version_tag)
        version_injector.inject_version_into_offline_manager(BUILD_SERVERLESS_DIR, version_tag)

        # 3. Bundle JS (Crucial for Serverless)
        if not js_bundler.bundle_javascript(BUILD_SERVERLESS_DIR):
             raise Exception("JS Bundling failed.")
            
        if not sw_patcher.patch_sw_assets_for_offline(BUILD_SERVERLESS_DIR):
             logger.warning("⚠️ Could not patch SW asset list")

        # 4. Bundle CSS
        if not css_bundler.bundle_css(BUILD_SERVERLESS_DIR):
            raise Exception("Serverless CSS Bundling failed.")

        # 5. Patch SW Style
        sw_patcher.patch_sw_style_bundle(BUILD_SERVERLESS_DIR)

        # 6. Patch HTML
        if not html_patcher.patch_offline_html(BUILD_SERVERLESS_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 7. Data Injection (JSONP/Global Var for file:// access)
        if not offline_converter.create_offline_index_js(BUILD_SERVERLESS_DIR):
             logger.warning("⚠️ Failed to create offline index JS")
        
        if not offline_converter.convert_db_json_to_js(BUILD_SERVERLESS_DIR):
             logger.warning("⚠️ Failed to convert DB JSON to JS")

        if not html_patcher.inject_offline_index_script(BUILD_SERVERLESS_DIR):
             logger.warning("⚠️ Failed to inject offline index script")

        # 8. Cleanup
        web_content_modifier.remove_db_bundle(BUILD_SERVERLESS_DIR)
        web_content_modifier.remove_redundant_index(BUILD_SERVERLESS_DIR)

        # Create Zip Artifact (Serverless Build is the downloadable artifact)
        if create_zip:
            if zip_packager.create_zip_from_build(BUILD_SERVERLESS_DIR, version_tag):
                 logger.info("✨ Serverless Artifacts Created.")
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
        logger.info(f"   👉 PWA (Standard):       {BUILD_PWA_DIR}")
        logger.info(f"   👉 Serverless (Bundled): {BUILD_SERVERLESS_DIR}")

    except Exception as e:
        logger.error(f"❌ FAILED: {e}")
        sys.exit(1)