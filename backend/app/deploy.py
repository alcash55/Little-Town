"""APP/Database deploy script"""

from database import engine
from models.base import Base


def main():
    with engine.begin() as conn:
        Base.metadata.drop_all(bind=conn)
    with engine.begin() as conn:
        Base.metadata.create_all(bind=conn)


if __name__ == "__main__":
    main()
