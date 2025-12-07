# Path: src/sutta_processor/shared/domain_types.py
from typing import TypedDict, Dict, Optional, Any

class SuttaMeta(TypedDict):
    uid: str
    type: str  # 'leaf' | 'branch' | 'subleaf' | 'alias'
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    best_author_uid: Optional[str]
    author_uid: Optional[str]
    # [NEW] extract_id thay thế cho scroll_target
    # Dùng để làm prefix filter lấy content segment
    extract_id: Optional[str] 

class SuttaSegment(TypedDict, total=False):
    pli: str
    eng: str
    html: str
    comm: str

class WorkerOutput(TypedDict):
    author_uid: Optional[str]
    data: Dict[str, SuttaSegment] 

class BookOutput(TypedDict):
    id: str
    title: str
    structure: Any
    meta: Dict[str, Dict[str, Any]]
    content: Dict[str, Dict[str, SuttaSegment]]