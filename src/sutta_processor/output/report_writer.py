# Path: src/sutta_processor/output/report_writer.py
import logging
from typing import List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger("SuttaProcessor.Output.ReportWriter")

# Type definitions
MissingItem = Tuple[str, str, str, str, str, str, str]
GeneratedItem = Tuple[str, str, str, str]

class ReportWriter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_missing_report(self, missing_items: List[MissingItem]) -> Optional[str]:
        if not missing_items:
            return None
        
        report_path = self.output_dir / "missing_links.tsv"
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("sutta\tsegment\tlink\tmentioned\tanchor_text\tmiss_uid\thash_id\n")
                for item in missing_items:
                    row = f"{item[0]}\t{item[1]}\t{item[2]}\t{item[3]}\t{item[4]}\t{item[5]}\t{item[6]}\n"
                    f.write(row)
            return f"⚠️  Missing Links Report: {report_path} ({len(missing_items)} items)"
        except Exception as e:
            logger.error(f"❌ Failed to write missing report: {e}")
            return None

    def write_generated_report(self, generated_items: List[GeneratedItem]) -> Optional[str]:
        if not generated_items:
            return None

        report_path = self.output_dir / "generated_items.tsv"
        try:
            # Sort for readability
            sorted_items = sorted(generated_items, key=lambda x: x[0])
            
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("UID\tType\tParent/Target\tExtract/Hash\n")
                for item in sorted_items:
                    f.write(f"{item[0]}\t{item[1]}\t{item[2]}\t{item[3]}\n")
            return f"📋 Generated Items Report: {report_path} ({len(sorted_items)} items)"
        except Exception as e:
            logger.error(f"❌ Failed to write generated report: {e}")
            return None