from flask import Blueprint, jsonify, request

from database import db
from models.event import Event

event_controller = Blueprint("event_controller", __name__)


@event_controller.route("/events", methods=["GET"])
def get_events():
    events = Event.query.all()
    return jsonify([event.to_dict() for event in events]), 200


@event_controller.route("/events", methods=["POST"])
def create_event():
    data = request.get_json()
    event = Event(
        name=data["name"], description=data.get("description"), date=data.get("date")
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@event_controller.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    event = Event.query.get_or_404(event_id)
    return jsonify(event.to_dict()), 200


@event_controller.route("/events/<int:event_id>", methods=["PUT"])
def update_event(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    event.name = data.get("name", event.name)
    event.date = data.get("date", event.date)
    event.location = data.get("location", event.location)
    db.session.commit()
    return jsonify(event.to_dict()), 200


@event_controller.route("/events/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return "", 204
