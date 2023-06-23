# Backend
This is a FastAPI/SQLAlchemy backend for an LT Event application

## Directory tree
```bash
backend
│   README.md
│   requirements.txt
│
└───app
    ├───migrations
    ├───models
    ├───routers
    └───schemas
        config.py
        database.py
        deploy.py
        main.py
```

* `README.md`: This file provides an overview of the project and its structure.
* `requirements.txt`: This file lists all the Python packages required to run the application.
* `app/migrations`: This directory contains Flask-Migrations files.
* `app/config.py`: This file contains the configuration settings for the application, including the database config.
* `app/__init__.py`: Empty file that indicates that this is Python module.
* `app/routers`: This directory contains API endpoints (routes).
* `app/models`: This directory contains the SQLAlchemy models for the application's database.

## Usage
To run the backend, you need to have Python 3 installed on your machine.

Navigate to `backend` directory:

```bash
cd backend
```

Create virtual environment:

```bash
python -m venv venv
```

Activate virtual env:

Windows:
```bash
venv\Scripts\activate.bat
```

Linux/MacOS:
```bash
source venv/bin/activate
```

Install required packages by running the following command:

```bash
python -m pip install -r requirements.txt
```

To start the development server, run the following command in `backend` directory:

```bash
uvicorn app.main:app --reload
```

This will start the server on http://localhost:8000/.

You can now open `http://localhost:8000/` in your browser to test that API works. Alternatively you can try healtz endpoint `http://localhost:8000/healthz/`.

## Database
To create the database with all tables, run the following command in the `backend` directory:

Fow now we use `deploy.py` to create database and in future we rely on Alembic migrations.

```bash
python app/deploy.py
```

### Migration

TODO: Use Alembic for database migrations