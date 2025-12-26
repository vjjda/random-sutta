# Path: src/dict_builder/logic/db_converter.py
import shutil
import sqlite3
import logging
from pathlib import Path
from ..builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.converter")

class DbConverter:
    @staticmethod
    def create_tiny_from_mini(mini_config: BuilderConfig, tiny_config: BuilderConfig) -> bool:
        """
        Tạo database Tiny bằng cách copy Mini và xóa cột dư thừa.
        Nhanh hơn rất nhiều so với build lại từ đầu.
        """
        src_path = mini_config.output_path
        dest_path = tiny_config.output_path
        
        if not src_path.exists():
            logger.error(f"Source DB not found: {src_path}. Cannot create Tiny version.")
            return False

        logger.info(f"⚡ Creating Tiny DB from Mini DB...")
        logger.info(f"   Copying {src_path.name} -> {dest_path.name}...")
        
        # 1. Copy file
        try:
            if dest_path.exists():
                dest_path.unlink()
            shutil.copy2(src_path, dest_path)
        except Exception as e:
            logger.error(f"Failed to copy DB: {e}")
            return False

        # 2. Modify DB
        conn = None
        try:
            conn = sqlite3.connect(dest_path)
            cursor = conn.cursor()
            
            # Determine suffix
            suffix = "html" if mini_config.html_mode else "json"
            
            logger.info("   Dropping grammar and example columns...")
            
            # [FIX] Drop View first to avoid dependency errors
            cursor.execute("DROP VIEW IF EXISTS grand_lookups")
            
            # SQLite does not support dropping multiple columns in one statement in older versions,
            # but modern SQLite does. To be safe, we use separate statements.
            # Also, standard SQLite DROP COLUMN might require VACUUM to reclaim space.
            
            cursor.execute(f"ALTER TABLE entries DROP COLUMN grammar_{suffix}")
            cursor.execute(f"ALTER TABLE entries DROP COLUMN example_{suffix}")
            
            # Update Metadata
            logger.info("   Updating metadata...")
            cursor.execute("UPDATE metadata SET value = ? WHERE key = 'mode'", ("tiny",))
            
            conn.commit()
            
            # 3. Optimize
            logger.info("   Optimizing (VACUUM)...")
            conn.execute("VACUUM")
            
            logger.info(f"✅ Tiny DB created successfully at {dest_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to convert DB: {e}")
            return False
        finally:
            if conn:
                conn.close()
