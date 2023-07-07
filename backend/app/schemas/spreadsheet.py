from typing import Optional

from pydantic import BaseModel


class CellItem(BaseModel):
    data: Optional[str | int | float]


class Cell(BaseModel):
    # data stored in cell
    value: CellItem
    # example: "E" || "E:"
    start_cell: str
    end_cell: Optional[str]


class Sheet(BaseModel):
    # example: "Sheet1!"
    name: str
    cells: list[Cell]
