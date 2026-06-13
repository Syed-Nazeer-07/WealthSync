from flask import session, jsonify
from finora.models import User


def get_current_user_id():
    return session["user_id"]


def get_current_user():
    uid = session.get("user_id")
    return User.query.get(uid) if uid else None


def success_response(data=None):
    response = {"success": True}
    if data:
        response.update(data)
    return jsonify(response)


def error_response(message, status_code=400):
    return jsonify({"error": message}), status_code
