# Path: src/dict_builder/logic/builder_exporter.py
import shutil
import zipfile
import logging
from pathlib import Path

logger = logging.getLogger("dict_builder")

class BuilderExporter:
    """
    Chuyên trách việc xuất bản, copy và nén file Database.
    """
    
    @staticmethod
    def compress_database_to_zip(db_path: Path) -> None:
        """Compress the database file into a .zip file."""
        zip_path = db_path.with_suffix(".db.zip")
        logger.info(f"[cyan]📦 Compressing database to {zip_path}...[/cyan]")
        
        if not db_path.exists():
            logger.error(f"[red]❌ File not found: {db_path}[/red]")
            return

        start_size = db_path.stat().st_size / (1024 * 1024)
        
        try:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(db_path, arcname=db_path.name)
                
            end_size = zip_path.stat().st_size / (1024 * 1024)
            ratio = (end_size / start_size) * 100 if start_size > 0 else 0
            logger.info(f"[green]✅ Compression Complete: {start_size:.2f}MB -> {end_size:.2f}MB ({ratio:.1f}%)[/green]")
        except Exception as e:
            logger.error(f"[red]❌ Compression failed: {e}[/red]")

    @staticmethod
    def export_to_web(local_db_path: Path, web_output_dir: Path) -> None:
        """Copy local DB to Web directory and compress it."""
        web_output_dir.mkdir(parents=True, exist_ok=True)
        web_db_path = web_output_dir / local_db_path.name
        
        logger.info(f"\n[bold blue]🌐 PROCESSING WEB EXPORT[/bold blue]")
        
        # Copy file
        logger.info(f"[cyan]Copying {local_db_path} -> {web_db_path}...[/cyan]")
        try:
            shutil.copy2(local_db_path, web_db_path)
            # Compress the copied file
            BuilderExporter.compress_database_to_zip(web_db_path)
        except Exception as e:
            logger.error(f"[red]❌ Export failed: {e}[/red]")