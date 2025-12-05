# Path: src/release_system/release_orchestrator.py
import logging
import sys

from .release_config import BUILD_OFFLINE_DIR, BUILD_ONLINE_DIR, CRITICAL_ASSETS
from .logic import (
    release_versioning,
    asset_validator,
    build_preparer,
    js_bundler,
    css_bundler,        # [NEW]
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
             raise Exception("Failed to inject version (Online).")

        # 2. Bundle CSS (Online cũng cần bundle CSS để tối ưu)
        if not css_bundler.bundle_css(BUILD_ONLINE_DIR):
            raise Exception("Online CSS Bundling failed.")

        # 3. Patch HTML (Online Mode: ESM JS + CSS Bundle)
        if not web_content_modifier.patch_online_html(BUILD_ONLINE_DIR, version_tag):
            raise Exception("Online HTML patching failed.")

        # 4. Deploy (nếu có cờ)
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
             raise Exception("Failed to inject version (Offline).")

        # 2. Bundle JS (Offline Only)
        if not js_bundler.bundle_javascript(BUILD_OFFLINE_DIR):
            raise Exception("JS Bundling failed.")

        # 3. Bundle CSS (Offline)
        if not css_bundler.bundle_css(BUILD_OFFLINE_DIR):
            raise Exception("Offline CSS Bundling failed.")

        # 4. Patch HTML (Offline Mode: JS Bundle + CSS Bundle)
        if not web_content_modifier.patch_offline_html(BUILD_OFFLINE_DIR, version_tag):
            raise Exception("HTML patching failed.")

        # 5. Create Zip
        if zip_packager.create_zip_from_build(BUILD_OFFLINE_DIR, version_tag):
            logger.info("✨ Offline Artifacts Created.")
        else:
            raise Exception("Archiving failed")

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