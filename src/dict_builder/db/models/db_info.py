# Path: src/dict_builder/db/models/db_info.py
import json
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class DbInfo(Base):
    """
    Store general key-value data such as
    1. dpd_db info, release_version, etc
    2. cached values, cf_set, etc.
    """

    __tablename__ = "db_info"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(unique=True)
    value: Mapped[str] = mapped_column(default="")

    # value pack unpack
    def value_pack(self, data) -> None:
        self.value = json.dumps(data, ensure_ascii=False)

    @property
    def value_unpack(self) -> list[str]:
        return json.loads(self.value) if self.value else []
