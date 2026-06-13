from flask import url_for, current_app
from flask_mail import Message
from finora.extensions import mail
import socket


_EMAIL_HEADER = """
<div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%);padding:32px 40px">
    <a href="{base_url}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px">
      <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px">Finora</span>
    </a>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Personal Finance OS</p>
  </div>
  <div style="padding:40px 40px 32px;color:#0f172a">
"""

_EMAIL_FOOTER = """
  </div>
  <div style="padding:20px 40px 28px;border-top:1px solid #e2e8f0;background:#f8fafc">
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">
      This email was sent to you because an action was performed on your Finora account.<br>
      If you didn't request this, you can safely ignore this email — your account remains secure.<br><br>
      &copy; 2026 Finora &nbsp;·&nbsp; <a href="{base_url}" style="color:#2563eb;text-decoration:none">Visit Finora</a>
    </p>
  </div>
</div>
"""


def get_base_url():
    """Get base URL for email links"""
    try:
        return url_for("index", _external=True).rstrip("/")
    except Exception:
        return "http://127.0.0.1:5000"


def send_email(to, subject, body_html):
    """Send email with timeout handling. Returns True on success, False on failure."""
    html = _EMAIL_HEADER.format(base_url=get_base_url()) + body_html + _EMAIL_FOOTER.format(base_url=get_base_url())
    try:
        current_app.logger.info(f"Attempting to send email to {to} via SMTP {current_app.config.get('MAIL_SERVER')}:{current_app.config.get('MAIL_PORT')}")
        msg = Message(subject=subject, recipients=[to], html=html)
        
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(10)
        
        try:
            mail.send(msg)
            current_app.logger.info(f"Email sent successfully to {to}")
            return True
        finally:
            socket.setdefaulttimeout(old_timeout)
            
    except socket.timeout:
        current_app.logger.error(f"SMTP timeout sending to {to} - connection timed out after 10s")
        return False
    except Exception as e:
        current_app.logger.error(f"Mail send failed to {to}: {type(e).__name__}: {e}")
        current_app.logger.error(f"SMTP Config - Server: {current_app.config.get('MAIL_SERVER')}, Port: {current_app.config.get('MAIL_PORT')}, TLS: {current_app.config.get('MAIL_USE_TLS')}")
        return False


def send_verification_email(user, token):
    """Send email verification link to user"""
    verify_url = url_for("verify_email", token=token, _external=True)
    body = f"""
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700">Hi {user.name},</h2>
    <p style="color:#64748b;margin:0 0 28px;line-height:1.7;font-size:15px">
      Thanks for signing up. Click the button below to verify your email address and activate your Finora account.
    </p>
    <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;margin-bottom:32px">
      Verify Email Address
    </a>
    <div style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Or paste this link in your browser</p>
      <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px">{verify_url}</p>
    </div>
    <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0;color:#1e3a8a;font-size:13px">🔒 <strong>Account security:</strong> This link expires in <strong>24 hours</strong> and can only be used once.</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">If you didn't create a Finora account, you can safely ignore this email. No account will be activated without verification.</p>
    """
    return send_email(user.email, "Verify your Finora account", body)


def send_password_reset_email(user, token):
    """Send password reset link to user"""
    reset_url = url_for("reset_password_page", token=token, _external=True)
    body = f"""
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700">Hi {user.name},</h2>
    <p style="color:#64748b;margin:0 0 28px;line-height:1.7;font-size:15px">
      We received a request to reset the password for your Finora account. Click the button below to choose a new password.
    </p>
    <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;margin-bottom:32px">
      Reset Password
    </a>
    <div style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Or paste this link in your browser</p>
      <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px">{reset_url}</p>
    </div>
    <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0;color:#7f1d1d;font-size:13px">⏰ <strong>This link expires in 1 hour</strong> and can only be used once. After that you'll need to request a new one.</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    """
    return send_email(user.email, "Reset your Finora password", body)
