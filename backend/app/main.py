from fastapi import Depends, FastAPI, HTTPException, status
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.items import router as items_router

app = FastAPI(
    title="StockPilot API",
    description="Stock inventory management and tracking platform",
    version="1.0.0",
)

instrumentator = Instrumentator().instrument(app)
instrumentator.expose(app, endpoint="/metrics")

app.include_router(items_router, prefix="/api/items", tags=["items"])


@app.get("/")
def read_root():
    return {"message": "StockPilot API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        )
