import os
from pathlib import Path

basedir = Path(__file__).resolve().parent


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URI", f"sqlite:///{Path(basedir) / 'app.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
