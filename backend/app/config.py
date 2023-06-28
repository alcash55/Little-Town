"""Put all core application configs here like logging, database stuff etc..."""

from google.oauth2 import service_account
from googleapiclient.discovery import build

# TODO: implement config dataclass
DATABASE_URL: str = "sqlite:///database.db"

# Load the Google API credentials
google_credentials = service_account.Credentials.from_service_account_file(
    "./app/secrets/credentials.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
)

# Create a Google Sheets API service client
google_sheets_service = build("sheets", "v4", credentials=google_credentials)
