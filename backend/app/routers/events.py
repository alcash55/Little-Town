from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db, models

router = APIRouter()


@router.post("/event/", response_model=schemas.Event)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    db_event = models.Event(name=event.name)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event
