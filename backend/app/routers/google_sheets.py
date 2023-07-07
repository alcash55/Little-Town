from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Path, Query

from .. import schemas
from ..caching import timed_lru_cache
from ..config import google_sheets_service

router = APIRouter()

def result_to_columnar_table(sheet_values):
    result = defaultdict(list)
    for sub_list in sheet_values:
        key = sub_list[0]
        values = sub_list[1:]
        result[key].extend(values)
    return result

@timed_lru_cache(seconds=10)
def read_sheet_data(sheet_id, tab_name):
    print("Fetching data from sheet instead of cache")
    request = (
        google_sheets_service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=tab_name, majorDimension="COLUMNS")
    )
    response = request.execute()
    sheet_values = response.get("values", [])
    result = result_to_columnar_table(sheet_values)
    return result


@router.get("/sheets/{sheet_id}/tab/{tab_name}/range/{range_id}")
async def get_range(
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    range_id: Annotated[str, Path()],
):
    values = read_sheet_data(sheet_id, tab_name=tab_name)
    return values


@router.get("/sheets/{sheet_id}/tab/{tab_name}/cell/{cell_id}")
async def get_cell(
    # Example function to retrieve data from a Google Sheet
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    cell_id: Annotated[str, Path()],
):
    values = read_sheet_data(sheet_id, tab_name=tab_name)
    return values


@router.post("/sheets/{sheet_id}/tab/{tab_name}/cell/{cell_id}")
async def insert_to_cell(
    cell_item: schemas.CellItem,
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    cell_id: Annotated[str, Path()],
):
    values = read_sheet_data(sheet_id, tab_name=tab_name)
    return values
