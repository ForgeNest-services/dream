from typing import Dict, List
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from core.email_service import EmailService
from core.configs import settings
from utils.logger import logger


class BrevoEmailService(EmailService):
    """Brevo (SendinBlue) email service implementation."""

    def __init__(self):
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = settings.BREVO_API_KEY
        self.api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str = None,
    ) -> bool:
        try:
            email_data = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": to_email}],
                sender={
                    "name": settings.BREVO_FROM_NAME,
                    "email": settings.BREVO_FROM_EMAIL,
                },
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )
            self.api_instance.send_transac_email(email_data)
            logger.info(f"Email sent to {to_email}")
            return True
        except ApiException as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}")
            return False

    def send_bulk_email(
        self,
        recipients: List[Dict[str, str]],
        subject: str,
        html_content: str,
        text_content: str = None,
    ) -> bool:
        try:
            to_list = [{"email": r["email"], "name": r.get("name", "")} for r in recipients]
            email_data = sib_api_v3_sdk.SendSmtpEmail(
                to=to_list,
                sender={
                    "name": settings.BREVO_FROM_NAME,
                    "email": settings.BREVO_FROM_EMAIL,
                },
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )
            self.api_instance.send_transac_email(email_data)
            logger.info(f"Bulk email sent to {len(recipients)} recipients")
            return True
        except ApiException as e:
            logger.error(f"Failed to send bulk email: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending bulk email: {e}")
            return False


brevo_service = BrevoEmailService()
