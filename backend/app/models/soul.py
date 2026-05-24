from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Soul(Base):
    __tablename__ = "souls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    principles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision_style: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    collaboration_style: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failure_handling_style: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    escalation_style: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
