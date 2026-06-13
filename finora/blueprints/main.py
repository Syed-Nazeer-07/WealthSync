from flask import Blueprint, render_template, redirect, url_for, session, jsonify, send_from_directory
from finora.extensions import db
from sqlalchemy import text
import os

main_bp = Blueprint('main', __name__)


@main_bp.route("/")
def index():
    if not session.get("user_id"):
        return redirect(url_for("auth.login_page"))
    return render_template("index.html")


@main_bp.route("/onboarding")
def onboarding_page():
    if not session.get("user_id"):
        return redirect(url_for("auth.login_page"))
    return render_template("onboarding.html")


@main_bp.route("/health", methods=["GET"])
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "database": "disconnected", "error": str(e)}), 503


@main_bp.route("/favicon.ico")
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')


@main_bp.route("/debug/oauth", methods=["GET"])
def debug_oauth():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return jsonify({"error": "OAuth credentials missing"}), 400
    from flask import url_for
    return jsonify({
        "client_id_loaded": bool(client_id),
        "client_id_length": len(client_id) if client_id else 0,
        "client_secret_loaded": bool(client_secret),
        "client_secret_length": len(client_secret) if client_secret else 0,
        "redirect_uri_template": url_for("auth.google_callback", _external=True),
        "app_url_scheme": os.environ.get("PREFERRED_URL_SCHEME", "http"),
        "google_client_config": {
            "client_id_starts_with": client_id[:20] if client_id else None,
            "client_secret_starts_with": client_secret[:10] if client_secret else None
        }
    })
