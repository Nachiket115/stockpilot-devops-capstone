from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, Integer, String, case, func
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="check_quantity_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    @hybrid_property
    def status(self) -> str:
        if self.quantity == 0:
            return "OUT_OF_STOCK"
        elif self.quantity <= self.reorder_level:
            return "LOW"
        return "IN_STOCK"

    @status.expression
    def status(cls):
        return case(
            (cls.quantity == 0, "OUT_OF_STOCK"),
            (cls.quantity <= cls.reorder_level, "LOW"),
            else_="IN_STOCK",
        )
