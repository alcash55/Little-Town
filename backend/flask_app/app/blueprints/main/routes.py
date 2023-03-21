from app.blueprints.main import bp
from flask import render_template


@bp.route("/")
def index():
    render_template("index.html")
