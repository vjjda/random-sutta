# Path: src/sutta_processor/logic/universe_builder.py
import logging
from typing import Dict, List, Set, FrozenSet, Any

from .range_expander import generate_vinaya_variants, expand_range_ids

logger = logging.getLogger("SuttaProcessor.Logic.UniverseBuilder")

class UniverseBuilder:
    @staticmethod
    def build(names_map: Dict[str, Any], book_tasks: Dict[str, List[Any]]) -> FrozenSet[str]:
        """
        Xây dựng tập hợp tất cả các UID hợp lệ (Universe) để validate link.
        Bao gồm:
        1. UID từ các Task thực tế (Leaf).
        2. UID từ Metadata khớp với Active Roots (Branch).
        3. UID được sinh ra từ Alias và Range Expansion.
        """
        task_based_uids: Set[str] = set()
        active_roots: Set[str] = set()

        # 1. Collect from Tasks
        for group, tasks in book_tasks.items():
            # Extract Root ID (e.g. "sutta/mn" -> "mn")
            root_id = group.split('/')[-1]
            active_roots.add(root_id)

            for task in tasks:
                # task[0] là UID (sutta_id)
                task_based_uids.add(task[0])

        logger.info(f"   🔍 Active Roots: {', '.join(sorted(active_roots))}")
        logger.info(f"   🔍 Task-based UIDs: {len(task_based_uids)}")

        # 2. Add Branches/Nodes from Metadata based on Active Roots
        expanded_universe = set(task_based_uids)
        count_branches = 0
        
        for uid in names_map:
            if uid in expanded_universe:
                continue
            for root in active_roots:
                if uid.startswith(root):
                    expanded_universe.add(uid)
                    count_branches += 1
                    break
        
        logger.info(f"   🔮 Metadata Expansion: Added {count_branches} branch UIDs.")

        # 3. Expand Aliases & Ranges
        # Convert to list to iterate safely while modifying set
        current_uids = list(expanded_universe)
        logger.info("   🔮 Expanding Aliases & Ranges...")
        
        for uid in current_uids:
            # Vinaya Variants
            variants = generate_vinaya_variants(uid)
            if variants:
                expanded_universe.update(variants)
            
            # Range Expansion (dhp383-423 -> dhp406)
            range_ids = expand_range_ids(uid)
            if range_ids:
                expanded_universe.update(range_ids)
        
        result = frozenset(expanded_universe)
        logger.info(f"✨ Universe Built: {len(result)} valid targets.")
        
        return result