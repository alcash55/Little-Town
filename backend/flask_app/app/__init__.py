from flask import Flask

from config import Config
from app.extensions import db, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize Flask extensions here
    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints here
    from app.blueprints.main import bp as main_bp

    app.register_blueprint(main_bp)

    from app.blueprints.events import bp as events_bp

    app.register_blueprint(events_bp, url_prefix="/events")

    return app
