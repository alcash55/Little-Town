from fastapi import FastAPI
from sqlalchemy.orm import Session

from .database import get_db
from .routers import events, google_sheets

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with the appropriate origin(s) if needed
    allow_methods=["GET"],  # Specify the HTTP methods allowed by your server
    allow_headers=["*"],  # Add any additional headers your client sends
)

app.include_router(events.router)
app.include_router(google_sheets.router)


@app.get("/healthz/")
async def health_check():
    return {"status_code": 200, "message": "OK"}


@app.get("/")
async def root():
    return {"message": "Hello World"}
