import os
from jinja2 import Environment, FileSystemLoader, select_autoescape
from utils.logger import logger

# Get the templates directory path
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

# Initialize Jinja2 environment
env = Environment(
    loader=FileSystemLoader(os.path.join(TEMPLATES_DIR, "emails")),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_email_template(template_name: str, **context) -> str:
    """
    Load and render an email template.

    Args:
        template_name: Name of the template file (e.g., 'team_invitation.html')
        **context: Variables to pass to the template

    Returns:
        Rendered HTML string
    """
    try:
        template = env.get_template(template_name)
        html_content = template.render(**context)
        return html_content
    except Exception as e:
        logger.error(f"Error rendering template {template_name}: {e}")
        raise
