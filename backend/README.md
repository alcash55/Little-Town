# Flask Backend
This is a Flask backend for an application that handles events. The backend consists of the following components:

* `main.py`: The main Flask application that sets up the routes and runs the server.
* `database.py`: A script that handles the database connection and initialization.
* `requirements.txt`: A list of the Python packages required by the application.
* `controllers/`: A directory containing modules that define the controllers for each endpoint.
* `models/`: A directory containing the SQLAlchemy models for the database tables.

## Usage
To run the backend, you need to have Python 3 installed on your machine. You can install the required packages by running the following command:

```bash
python -m pip install -r requirements.txt
```

To start the server, run the following command:

```bash
python main.py
```

This will start the server on http://localhost:5000/.