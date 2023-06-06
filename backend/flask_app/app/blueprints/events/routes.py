from app.blueprints.events import bp
from app.extensions import db
from app.models.event import Event
from flask import jsonify, render_template, request


@bp.route("/")
def index():
    return render_template("events/index.html")


@bp.route("/events", methods=["GET"])
def get_events():
    events = Event.query.all()
    return jsonify([event.to_dict() for event in events]), 200


@bp.route("/events", methods=["POST"])
def create_event():
    data = request.get_json()
    event = Event(name=data["name"], description=data.get("description"))
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    event = Event.query.get_or_404(event_id)
    return jsonify(event.to_dict()), 200


@bp.route("/events/<int:event_id>", methods=["PUT"])
def update_event(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    event.name = data.get("name", event.name)
    event.description = data.get("description", event.description)
    db.session.commit()
    return jsonify(event.to_dict()), 200


@bp.route("/events/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return "", 204
