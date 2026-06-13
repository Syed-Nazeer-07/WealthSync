from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timedelta
import secrets

from finora.extensions import db
from finora.models import UserSettings, User
from finora.services.settings_service import get_or_create_settings, settings_to_dict, update_settings_from_data
from finora.services.auth_service import validate_password
from finora.services.email_service import send_verification_email
from finora.utils import login_required, get_current_user_id, get_current_user

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')


@settings_bp.route('/', methods=['GET'])
@login_required
def get_settings():
    s = get_or_create_settings(get_current_user_id(), db, UserSettings)
    return jsonify(settings_to_dict(s))


@settings_bp.route('/', methods=['PUT'])
@login_required
def update_settings():
    s = get_or_create_settings(get_current_user_id(), db, UserSettings)
    data = request.get_json(silent=True) or {}
    update_settings_from_data(s, data)
    db.session.commit()
    return jsonify(settings_to_dict(s))


@settings_bp.route('/update-name', methods=['POST'])
@login_required
def update_name():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 100:
        return jsonify({"error": "Name must be 1–100 characters"}), 400
    user = get_current_user()
    user.name = name
    db.session.commit()
    return jsonify({"success": True, "name": user.name})


@settings_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    user = get_current_user()
    if not user.password_hash:
        return jsonify({"error": "Password managed by Google"}), 400
    if not check_password_hash(user.password_hash, data.get("current_password", "")):
        return jsonify({"error": "Current password is incorrect"}), 401
    new_pw = data.get("new_password", "")
    is_valid, error = validate_password(new_pw)
    if not is_valid:
        return jsonify({"error": error}), 400
    user.password_hash = generate_password_hash(new_pw)
    db.session.commit()
    return jsonify({"success": True})


@settings_bp.route('/resend-verification', methods=['POST'])
@login_required
def resend_verification_settings():
    user = get_current_user()
    if user.email_verified:
        return jsonify({"error": "Email already verified"}), 400
    user.email_verification_token = secrets.token_urlsafe(32)
    user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()
    send_verification_email(user, user.email_verification_token)
    return jsonify({"success": True})
