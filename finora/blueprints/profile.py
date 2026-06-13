from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Profile
from finora.services.profile_service import profile_to_dict, update_profile_from_data
from finora.utils import login_required, get_current_user_id

profile_bp = Blueprint('profile', __name__, url_prefix='/api/profile')

@profile_bp.route('/', methods=['GET'])
@login_required
def get_profile():
    p = Profile.query.filter_by(user_id=get_current_user_id()).first()
    if not p:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify(profile_to_dict(p))

@profile_bp.route('/', methods=['PUT'])
@login_required
def update_profile():
    p = Profile.query.filter_by(user_id=get_current_user_id()).first()
    if not p:
        return jsonify({"error": "Profile not found"}), 404
    data = request.get_json(silent=True) or {}
    success, error = update_profile_from_data(p, data)
    if not success:
        return jsonify({"error": error}), 400
    db.session.commit()
    return jsonify({"success": True})
