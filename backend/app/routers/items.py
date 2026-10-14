from fastapi import APIRouter, Depends, HTTPException, Response, status
from prometheus_client import Counter
from sqlalchemy import case, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Item
from app.schemas import IssueRequest, ItemCreate, ItemOut, ItemUpdate, StatsOut

router = APIRouter()

units_issued_total = Counter(
    "units_issued_total",
    "Total number of item units issued",
)


@router.get("", response_model=list[ItemOut])
def list_items(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Item)
    if status:
        status_val = status.strip().upper()
        stmt = stmt.where(Item.status == status_val)
    stmt = stmt.order_by(Item.id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Item).where(Item.sku == payload.sku))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item with SKU '{payload.sku}' already exists",
        )
    item = Item(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item with SKU '{payload.sku}' already exists",
        )
    db.refresh(item)
    return item


@router.get("/stats", response_model=StatsOut)
def get_item_stats(db: Session = Depends(get_db)):
    stmt = select(
        func.count(Item.id).label("total"),
        func.coalesce(func.sum(case((Item.status == "IN_STOCK", 1), else_=0)), 0).label("in_stock"),
        func.coalesce(func.sum(case((Item.status == "LOW", 1), else_=0)), 0).label("low"),
        func.coalesce(func.sum(case((Item.status == "OUT_OF_STOCK", 1), else_=0)), 0).label("out_of_stock"),
    )
    row = db.execute(stmt).one()
    return StatsOut(
        total=row.total,
        in_stock=row.in_stock,
        low=row.low,
        out_of_stock=row.out_of_stock,
    )


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.scalar(select(Item).where(Item.id == item_id))
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return item


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.scalar(select(Item).where(Item.id == item_id))
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )

    sku_owner = db.scalar(select(Item).where(Item.sku == payload.sku, Item.id != item_id))
    if sku_owner:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item with SKU '{payload.sku}' already exists",
        )

    for field, val in payload.model_dump().items():
        setattr(item, field, val)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item with SKU '{payload.sku}' already exists",
        )
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.scalar(select(Item).where(Item.id == item_id))
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{item_id}/issue", response_model=ItemOut)
def issue_item(item_id: int, payload: IssueRequest, db: Session = Depends(get_db)):
    stmt = (
        update(Item)
        .where(Item.id == item_id, Item.quantity >= payload.quantity)
        .values(quantity=Item.quantity - payload.quantity)
        .returning(Item)
    )
    result = db.scalars(stmt)
    updated_item = result.one_or_none()

    if updated_item is not None:
        db.commit()
        db.refresh(updated_item)
        units_issued_total.inc(payload.quantity)
        return updated_item

    item = db.scalar(select(Item).where(Item.id == item_id))
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Insufficient stock for SKU {item.sku}: {item.quantity} on hand, cannot issue {payload.quantity}",
    )
