from flask import Blueprint

bp = Blueprint("events", __name__)


from app.blueprints.events import routes
