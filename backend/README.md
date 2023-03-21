# Flask Backend
This is a Flask backend for an LT Event application

## Directory tree
```bash
backend
│   README.md
│   requirements.txt
│
├───flask_app
│   │   app.db
│   │   config.py
│   │
│   └───app
│       │   __init__.py
│       │   extensions.py
│       │
│       ├───blueprints
│       │
│       └───models
│
├───migrations
│
└───test
```

* `README.md`: This file provides an overview of the project and its structure.
* `requirements.txt`: This file lists all the Python packages required to run the application.
* `migrations`: This directory contains Flask-Migrations files.
* `flask_app/config.py`: This file contains the configuration settings for the application, including the database config.
* `flask_app/app/extensions.py`: This file initializes the Flask-Migrate and Flask-SQLAlchemy extensions.
* `flask_app/app/__init__.py`: This file creates the Flask application factory, which initializes the application and its extensions.
* `flask_app/app/blueprints`: This directory contains the Flask blueprints and routes.
* `flask_app/app/models`: This directory contains the SQLAlchemy models for the application's database.
* `tests`: This directory contains unit tests for the application.

## Usage
To run the backend, you need to have Python 3 installed on your machine.

Navigate to `backend` directory:

```bash
cd backend
```

Install required packages by running the following command:

```bash
python -m pip install -r requirements.txt
```

To start the development server, run the following command:

```bash
flask --app flask_app/app run
```

This will start the server on http://localhost:5000/.

## Database
To create the database with all tables, run the following command in the `backend` directory:


```bash
flask --app flask_app/app shell
```

In the shell, run the following function to create the database:

```bash
db.create_all()
quit()
```

Use `db.drop_all()` to clean database and `db.create_all()` to recreate database.

### Migration
To make changes to the database, use Flask-Migrate's command-line tool

Create a new migration with following command:

```bash
flask --app flask_app/app db migrate -m "message"
```

Apply the migration to the database with following command:

```bash
flask --app flask_app/app db upgrade
```

## Tests

TODO