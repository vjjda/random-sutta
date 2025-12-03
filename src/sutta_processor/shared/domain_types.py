# Path: src/sutta_processor/shared/domain_types.py
from typing import TypedDict, Dict, Optional, Any

class SuttaMeta(TypedDict):
    uid: str
    type: str  # 'leaf' | 'branch'
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    best_author_uid: Optional[str]
    # [NEW] Author UID sẽ được chuyển vào đây khi merge dữ liệu
    author_uid: Optional[str] 

class SuttaSegment(TypedDict, total=False):
    pli: str
    eng: str   # [CHANGED] en -> eng
    html: str
    comm: str

# [CHANGED] Payload trả về từ worker
class WorkerOutput(TypedDict):
    author_uid: Optional[str]
    # Không còn key "segments" bao bọc, trả về trực tiếp dict của segments
    data: Dict[str, SuttaSegment] 

class BookOutput(TypedDict):
    id: str
    title: str
    structure: Any
    meta: Dict[str, Dict[str, Any]]
    content: Dict[str, Dict[str, SuttaSegment]] # [CHANGED] data -> content