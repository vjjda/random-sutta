# Path: src/sutta_processor/shared/domain_types.py
from typing import TypedDict, Dict, Optional, Any

class SuttaMeta(TypedDict):
    uid: str
    type: str
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    best_author_uid: Optional[str]

class SuttaSegment(TypedDict, total=False):
    pli: str
    en: str
    html: str
    comm: str

class BookOutput(TypedDict):
    id: str
    title: str
    structure: Any
    meta: Dict[str, Dict[str, Any]]
    data: Dict[str, Any]