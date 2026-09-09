from services.brevo_service import brevo_service
from utils.logger import logger
from utils.template_loader import render_email_template


def send_team_invitation_email(
    recipient_email: str,
    recipient_name: str,
    invited_by: str,
    business_name: str,
    role: str,
    invitation_link: str,
):
    """Send team member invitation email."""
    try:
        subject = f"You're invited to join {business_name} on Dream"

        html_content = render_email_template(
            "team_invitation.html",
            recipient_name=recipient_name,
            business_name=business_name,
            invited_by=invited_by,
            role=role,
            invitation_link=invitation_link,
        )

        success = brevo_service.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )

        if success:
            logger.info(f"Team invitation email sent to {recipient_email}")
        else:
            logger.error(f"Failed to send team invitation email to {recipient_email}")

        return success

    except Exception as e:
        logger.error(f"Error in send_team_invitation_email: {e}")
        return False


def send_otp_verification_email(
    recipient_email: str,
    recipient_name: str,
    otp_code: str,
    expiry_minutes: int = 10,
):
    """Send OTP verification email."""
    try:
        subject = "Verify Your Email Address"

        html_content = render_email_template(
            "verification_otp.html",
            recipient_name=recipient_name,
            otp_code=otp_code,
            expiry_minutes=expiry_minutes,
        )

        success = brevo_service.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )

        if success:
            logger.info(f"OTP verification email sent to {recipient_email}")
        else:
            logger.error(f"Failed to send OTP verification email to {recipient_email}")

        return success

    except Exception as e:
        logger.error(f"Error in send_otp_verification_email: {e}")
        return False


def send_query_autoreply_email(recipient_email: str, recipient_name: str):
    """Auto-reply sent the moment a public contact-form submission
    (ui/contact.html -> POST /queries) lands -- confirms receipt, not a
    real response. Superadmin reads/replies to the actual query by hand."""
    try:
        subject = "We received your message — Srota"

        html_content = render_email_template(
            "query_autoreply.html",
            recipient_name=recipient_name,
        )

        success = brevo_service.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )

        if success:
            logger.info(f"Query auto-reply sent to {recipient_email}")
        else:
            logger.error(f"Failed to send query auto-reply to {recipient_email}")

        return success

    except Exception as e:
        logger.error(f"Error in send_query_autoreply_email: {e}")
        return False


def send_password_reset_otp_email(
    recipient_email: str,
    recipient_name: str,
    otp_code: str,
    expiry_minutes: int = 5,
):
    """Send the password-reset OTP code (distinct from send_password_reset_email
    below, which is a link-based flow no route currently issues)."""
    try:
        subject = "Reset Your Password"

        html_content = render_email_template(
            "password_reset_otp.html",
            recipient_name=recipient_name,
            otp_code=otp_code,
            expiry_minutes=expiry_minutes,
        )

        success = brevo_service.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )

        if success:
            logger.info(f"Password reset OTP email sent to {recipient_email}")
        else:
            logger.error(f"Failed to send password reset OTP email to {recipient_email}")

        return success

    except Exception as e:
        logger.error(f"Error in send_password_reset_otp_email: {e}")
        return False


def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_link: str,
    expiry_minutes: int = 30,
):
    """Send password reset email."""
    try:
        subject = "Reset Your Password"

        html_content = render_email_template(
            "password_reset.html",
            recipient_name=recipient_name,
            reset_link=reset_link,
            expiry_minutes=expiry_minutes,
        )

        success = brevo_service.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )

        if success:
            logger.info(f"Password reset email sent to {recipient_email}")
        else:
            logger.error(f"Failed to send password reset email to {recipient_email}")

        return success

    except Exception as e:
        logger.error(f"Error in send_password_reset_email: {e}")
        return False
