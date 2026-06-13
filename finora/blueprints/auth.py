from flask import Blueprint, render_template, redirect, url_for, session, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets

from finora.extensions import db, oauth
from finora.models import User, Profile, Category
from finora.services.auth_service import validate_password, validate_signup_data
from finora.services.email_service import send_verification_email, send_password_reset_email
from finora.services.category_service import create_default_categories_for_user
from finora.utils import get_current_user

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/login")
def login_page():
    if session.get("user_id"):
        return redirect(url_for("main.index"))
    return render_template("login.html")


@auth_bp.route("/api/auth/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        is_valid, error = validate_signup_data(name, email, password)
        if not is_valid:
            return jsonify({"error": error}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with that email already exists"}), 409

        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=24)

        user = User(
            name=name, email=email,
            password_hash=generate_password_hash(password),
            email_verified=False,
            email_verification_token=token,
            email_verification_expires=expires,
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(Profile(user_id=user.id))
        
        create_default_categories_for_user(user.id, db, Category)
        
        db.session.commit()

        email_sent = send_verification_email(user, token)
        if not email_sent:
            return jsonify({
                "success": True,
                "pending": True,
                "email": email,
                "verification_email_sent": False,
                "message": "Account created. Verification email could not be sent."
            }), 201

        return jsonify({
            "success": True,
            "pending": True,
            "email": email,
            "verification_email_sent": True
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred during signup. Please try again."}), 500


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    try:
        user = User.query.filter_by(email=email).first()
        if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password"}), 401
    except Exception:
        return jsonify({"error": "Invalid email or password"}), 401
    
    if not user.email_verified:
        return jsonify({"error": "Please verify your email before continuing.", "unverified": True, "email": email}), 403

    session["user_id"] = user.id
    return jsonify({"id": user.id, "name": user.name, "email": user.email})


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


@auth_bp.route("/api/auth/me")
def me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "google_id": user.google_id,
        "has_password": bool(user.password_hash),
    })


@auth_bp.route("/verify-email/<token>")
def verify_email(token):
    user = User.query.filter_by(email_verification_token=token).first()
    if not user or not user.email_verification_expires or datetime.utcnow() > user.email_verification_expires:
        return render_template("verify_failed.html")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    db.session.commit()
    return render_template("verify_success.html", name=user.name)


@auth_bp.route("/verify-pending")
def verify_pending():
    email = request.args.get("email", "")
    return render_template("verify_pending.html", email=email)


@auth_bp.route("/forgot-password")
def forgot_password_page():
    return render_template("forgot_password.html")


@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()

        user = User.query.filter_by(email=email).first()
        if user and user.password_hash and user.email_verified:
            user.password_reset_token = secrets.token_urlsafe(32)
            user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
            db.session.commit()
            
            send_password_reset_email(user, user.password_reset_token)

        return jsonify({"message": "If an account exists, a password reset email has been sent."})
    except Exception:
        db.session.rollback()
        return jsonify({"error": "An error occurred. Please try again."}), 500


@auth_bp.route("/reset-password/<token>")
def reset_password_page(token):
    user = User.query.filter_by(password_reset_token=token).first()
    if not user or not user.password_reset_expires or datetime.utcnow() > user.password_reset_expires:
        return render_template("verify_failed.html", mode="reset")
    return render_template("reset_password.html", token=token)


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    password = data.get("password", "")

    is_valid, error = validate_password(password)
    if not is_valid:
        return jsonify({"error": error}), 400

    user = User.query.filter_by(password_reset_token=token).first()
    if not user or not user.password_reset_expires or datetime.utcnow() > user.password_reset_expires:
        return jsonify({"error": "Reset link is invalid or has expired"}), 400

    user.password_hash = generate_password_hash(password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.session.commit()
    return jsonify({"success": True})


@auth_bp.route("/api/auth/resend-verification", methods=["POST"])
def resend_verification():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()
    if user and not user.email_verified and user.password_hash:
        can_resend = (
            not user.email_verification_expires or
            datetime.utcnow() > user.email_verification_expires - timedelta(hours=23, minutes=59)
        )
        if can_resend:
            user.email_verification_token = secrets.token_urlsafe(32)
            user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
            db.session.commit()
            send_verification_email(user, user.email_verification_token)

    return jsonify({"message": "If that email is registered and unverified, a new link has been sent."})


@auth_bp.route("/auth/google")
def google_login():
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/auth/google/callback")
def google_callback():
    if request.args.get("error"):
        return redirect(url_for("auth.login_page"))
    
    try:
        token = oauth.google.authorize_access_token()
    except Exception:
        return redirect(url_for("auth.login_page"))
    
    info = token.get("userinfo")
    if not info:
        return redirect(url_for("auth.login_page"))

    google_id = info["sub"]
    email = info["email"]
    name = info.get("name") or email.split("@")[0]

    is_new = False
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.email_verified = True
        else:
            user = User(name=name, email=email, google_id=google_id, email_verified=True)
            db.session.add(user)
            db.session.flush()
            db.session.add(Profile(user_id=user.id))
            
            create_default_categories_for_user(user.id, db, Category)
            
            is_new = True
        db.session.commit()

    session["user_id"] = user.id

    if is_new:
        return redirect(url_for("main.onboarding_page"))

    profile = Profile.query.filter_by(user_id=user.id).first()
    if not profile or not profile.onboarding_completed:
        return redirect(url_for("main.onboarding_page"))

    return redirect(url_for("main.index"))
