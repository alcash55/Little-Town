from flask import Flask, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
from flask import jsonify

app = Flask(__name__)

# Load the Google API credentials
credentials = service_account.Credentials.from_service_account_file(
    '/credentials.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)

# Create a Google Sheets API service client
service = build('sheets', 'v4', credentials=credentials)


@app.route('/')
def get_data():
    # Example function to retrieve data from a Google Sheet
    sheet_id = '1UjU_uigJ_ZSvOpj2TiZ51nKgJYJd4I2QyJ5aM--mF7I'
    range_name = 'Sheet1!A:D'  # Modify as per your sheet and range

    # Make a request to the Google Sheets API
    sheet = service.spreadsheets()
    result = sheet.values().get(spreadsheetId=sheet_id, range=range_name).execute()
    values = result.get('values', [])

    # Render the retrieved data into JSON
    return jsonify(values)

    # Render the retrieved data in a template
    # return render_template('index.html', values=values)


if __name__ == '__main__':
    app.run()
