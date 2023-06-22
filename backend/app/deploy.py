"""APP/Database deploy script"""

from db import engine
from db.models.base import Base


def main():
    with engine.begin() as conn:
        Base.metadata.drop_all(bind=conn)
    with engine.begin() as conn:
        Base.metadata.create_all(bind=conn)


if __name__ == "__main__":
    main()
