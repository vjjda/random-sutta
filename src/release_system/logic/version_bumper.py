import logging
import json
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("Release.VersionBumper")

def update_package_json(project_root: Path, version: str) -> bool:
    pkg_path = project_root / "package.json"
    if not pkg_path.exists(): return False
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get("version") == version:
            return True
        data["version"] = version
        with open(pkg_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Updated package.json -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update package.json: {e}")
        return False

def update_xcode_version(project_root: Path, version: str) -> bool:
    pbxproj_path = project_root / "ios/App/App.xcodeproj/project.pbxproj"
    if not pbxproj_path.exists(): return False
    try:
        import re
        with open(pbxproj_path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = re.sub(r'MARKETING_VERSION = [^;]+;', f'MARKETING_VERSION = {version};', content)
        with open(pbxproj_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        logger.info(f"✅ Updated iOS version -> {version}")
        return True
    except Exception: return False

def update_android_version(project_root: Path, version: str) -> bool:
    gradle_path = project_root / "android/app/build.gradle"
    if not gradle_path.exists(): return False
    try:
        import re
        with open(gradle_path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = re.sub(r'versionName "[^"]+"', f'versionName "{version}"', content)
        
        epoch_base = datetime(2024, 1, 1)
        now = datetime.now()
        version_code = 1000000000 + int((now - epoch_base).total_seconds() / 60)
        
        new_content = re.sub(r'versionCode \d+', f'versionCode {version_code}', new_content)
        with open(gradle_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        logger.info(f"✅ Updated Android version -> {version} (code: {version_code})")
        return True
    except Exception: return False

def update_tauri_version(project_root: Path, version: str) -> bool:
    conf_path = project_root / "src-tauri/tauri.conf.json"
    cargo_path = project_root / "src-tauri/Cargo.toml"
    success = True
    if conf_path.exists():
        try:
            with open(conf_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data["version"] = version
            with open(conf_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ Updated tauri.conf.json -> {version}")
        except Exception: success = False
    if cargo_path.exists():
        try:
            import re
            with open(cargo_path, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = re.sub(r'^version = "[^"]+"', f'version = "{version}"', content, flags=re.MULTILINE)
            with open(cargo_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            logger.info(f"✅ Updated Cargo.toml -> {version}")
        except Exception: success = False
    return success

def update_pyproject_version(project_root: Path, version: str) -> bool:
    pyproject_path = project_root / "pyproject.toml"
    if not pyproject_path.exists(): return False
    try:
        import re
        with open(pyproject_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = re.sub(r'^version\s*=\s*"[^"]+"', f'version = "{version}"', content, flags=re.MULTILINE)
        
        if content == new_content:
            return True
            
        with open(pyproject_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        logger.info(f"✅ Updated pyproject.toml -> {version}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update pyproject.toml: {e}")
        return False

def bump_versions(project_root: Path, version: str, target: str = 'all'):
    """
    Selectively updates version across different project files.
    target: 'all', 'web', 'android', 'ios', 'macos', 'py'
    """
    logger.info(f"🔄 Bumping versions for target: {target}")
    
    if target in ['all', 'web']:
        update_package_json(project_root, version)
        
    if target in ['all', 'py']:
        update_pyproject_version(project_root, version)
        
    if target in ['all', 'android']:
        update_android_version(project_root, version)
        
    if target in ['all', 'ios']:
        update_xcode_version(project_root, version)
        
    if target in ['all', 'macos']:
        update_tauri_version(project_root, version)

