from abc import ABC, abstractmethod
from typing import Dict, List, Optional


class EmailService(ABC):
    """Abstract email service interface for easy provider switching."""

    @abstractmethod
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str = None,
    ) -> bool:
        """Send email to a single recipient."""
        pass

    @abstractmethod
    def send_bulk_email(
        self,
        recipients: List[Dict[str, str]],
        subject: str,
        html_content: str,
        text_content: str = None,
    ) -> bool:
        """Send email to multiple recipients."""
        pass
