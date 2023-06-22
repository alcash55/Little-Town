from fastapi import FastAPI
from sqlalchemy.orm import Session

from .db import get_db
from .routers import events

app = FastAPI()

app.include_router(events.router)


@app.get("/healthz/")
async def health_check():
    return {"status_code": 200, "message": "OK"}


@app.get("/")
async def root():
    return {"message": "Hello World"}
