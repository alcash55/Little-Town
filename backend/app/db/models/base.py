from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Optional[Mapped[datetime]] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
