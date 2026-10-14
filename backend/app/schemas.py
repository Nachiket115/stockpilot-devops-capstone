from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ItemBase(BaseModel):
    name: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(..., ge=0)
    location: str = Field(..., min_length=1)

    @field_validator("name", "sku", "category", "location")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or whitespace only")
        return stripped


class ItemCreate(ItemBase):
    pass


class ItemUpdate(ItemBase):
    pass


class IssueRequest(BaseModel):
    quantity: int = Field(..., gt=0, description="Quantity to issue, must be greater than 0")


class ItemOut(ItemBase):
    id: int
    created_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class StatsOut(BaseModel):
    total: int
    in_stock: int
    low: int
    out_of_stock: int
