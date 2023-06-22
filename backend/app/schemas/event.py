from datetime import datetime

from pydantic import BaseModel


class EventBase(BaseModel):
    name: str


class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class EventCreate(EventBase):
    pass