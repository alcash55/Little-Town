from typing import Annotated

from fastapi import APIRouter, Path, Query

from ..config import google_sheets_service
from .. import schemas
from ..caching import timed_lru_cache

router = APIRouter()


@timed_lru_cache(seconds=10)
def read_sheet_data(sheet_id, range):
    print("Fetching data from sheet instead of cache")
    sheet = google_sheets_service.spreadsheets()
    result = sheet.values().get(spreadsheetId=sheet_id, range=range).execute()
    values = result.get("values", [])
    return values


@router.get("/sheets/{sheet_id}/tab/{tab_name}/range/{range_id}")
async def get_range(
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    range_id: Annotated[str, Path()]
):
    range = f"{tab_name}!{range_id}"
    values = read_sheet_data(sheet_id, range)
    return values


@router.get("/sheets/{sheet_id}/tab/{tab_name}/cell/{cell_id}")
async def get_cell(
    # Example function to retrieve data from a Google Sheet
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    cell_id: Annotated[str, Path()]
):
    range =f"{tab_name}!{cell_id}"
    # Make a request to the Google Sheets API
    sheet = google_sheets_service.spreadsheets()
    result = sheet.values().get(spreadsheetId=sheet_id, range=range).execute()
    values = result.get("values", [])
    return values


@router.post("/sheets/{sheet_id}/tab/{tab_name}/cell/{cell_id}")
async def insert_to_cell(
    cell_item: schemas.CellItem,
    sheet_id: Annotated[str, Path()],
    tab_name: Annotated[str, Path()],
    cell_id: Annotated[str, Path()]
):
    range =f"{tab_name}!{cell_id}"
    # TODO: insert cell item to cell
    sheet = google_sheets_service.spreadsheets()
    result = sheet.values().get(spreadsheetId=sheet_id, range=range).execute()
    values = result.get("values", [])
    return values
