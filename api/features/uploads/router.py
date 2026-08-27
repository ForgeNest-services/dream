from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_scope
from core.storage import upload_file
from features.branches.repository import BranchRepository
from utils.helpers import success_response, error_response

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Apps allowed to upload, and whether their prefix requires a branch_id.
# Extend this as new apps come online — no other code changes needed.
APP_PREFIXES = {
    "restro": True,
    "hotel_pms": True,
    "ims": False,
    "admin": False,
}


@router.post("")
async def upload(
    app: str = Form(...),
    category: str = Form(...),
    branch_id: str | None = Form(None),
    file: UploadFile = File(...),
    scope: dict = Depends(require_tenant_scope),
    db: Session = Depends(get_db),
):
    if app not in APP_PREFIXES:
        return error_response("INVALID_APP", f"Unknown app '{app}'.", 400)

    branch_required = APP_PREFIXES[app]
    if branch_required and not branch_id:
        return error_response("BRANCH_REQUIRED", "branch_id is required for this app.", 422)

    # Staff tokens locked to one branch can only upload into that branch's
    # prefix — never trust the client-supplied branch_id beyond that check.
    if scope["source"] == "staff" and scope.get("branch_id") and branch_id != scope["branch_id"]:
        raise HTTPException(403, "Not allowed for this branch")

    # Platform/owner tokens and tenant-wide staff (App Owner) aren't locked
    # to one branch by the check above, so branch_id is still whatever the
    # client typed — verify it's a real branch on this tenant before it
    # becomes part of a storage path. Never trust a client-supplied ID past
    # this point (project convention — see CLAUDE.md).
    if branch_id and not BranchRepository.get_by_id(db, scope["tenant_id"], branch_id):
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        return error_response(
            "UNSUPPORTED_FILE_TYPE",
            f"File type '{file.content_type}' not allowed.",
            415,
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        return error_response("FILE_TOO_LARGE", "File must be 5MB or smaller.", 413)

    tenant_id = scope["tenant_id"]
    prefix_parts = [app, tenant_id]
    if branch_id:
        prefix_parts.append(branch_id)
    prefix_parts.append(category)
    prefix = "/".join(prefix_parts)

    url = upload_file(prefix, file.filename or "upload", content, file.content_type)

    return success_response(data={"url": url}, message="Uploaded", status_code=201)
