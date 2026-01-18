import os
import uuid
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.models import db, User, Wiki, Page, Attachment

attachments_bp = Blueprint('attachments', __name__)


def get_file_type(mime_type: str, extension: str) -> str:
    """Determine file type category from mime type or extension."""
    image_types = {'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'}
    if mime_type in image_types or extension in {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}:
        return 'image'
    
    doc_types = {'application/pdf', 'application/msword', 
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'text/plain', 'text/markdown', 'text/csv',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
    if mime_type in doc_types or extension in {'pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xlsx'}:
        return 'document'
    
    code_types = {'text/javascript', 'application/javascript', 'text/html', 'text/css',
                  'application/json', 'text/x-python', 'application/x-yaml'}
    if mime_type in code_types or extension in {'py', 'js', 'ts', 'html', 'css', 'json', 'yaml', 'yml'}:
        return 'code'
    
    return 'other'


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    config = current_app.config
    all_allowed = set()
    for exts in config.get('ALLOWED_EXTENSIONS', {}).values():
        all_allowed.update(exts)
    return ext in all_allowed


def check_page_access(wiki_id: int, page_id: int, user_id: int, require_edit: bool = False) -> tuple[Page | None, str | None]:
    """Check if user has access to a page."""
    wiki = Wiki.query.get(wiki_id)
    if not wiki:
        return None, 'Wiki not found'
    
    page = Page.query.filter_by(id=page_id, wiki_id=wiki_id).first()
    if not page:
        return None, 'Page not found'
    
    user = User.query.get(user_id)
    if not user:
        return None, 'User not found'
    
    if wiki.owner_id == user_id or user.is_admin:
        return page, None
    
    role = user.get_wiki_role(wiki_id)
    
    if wiki.is_public and not require_edit:
        return page, None
    
    if not role:
        return None, 'Access denied'
    
    if require_edit and role == 'viewer':
        return None, 'Permission denied'
    
    return page, None


# Routes for page attachments
@attachments_bp.route('/api/wikis/<int:wiki_id>/pages/<int:page_id>/attachments', methods=['GET'])
@jwt_required()
def list_attachments(wiki_id, page_id):
    """List all attachments for a page."""
    current_user_id = int(get_jwt_identity())
    page, error = check_page_access(wiki_id, page_id, current_user_id)
    
    if error:
        status = 404 if 'not found' in error else 403
        return jsonify({'error': error}), status
    
    attachments = page.attachments.all()
    return jsonify({
        'attachments': [a.to_dict() for a in attachments],
        'count': len(attachments)
    }), 200


@attachments_bp.route('/api/wikis/<int:wiki_id>/pages/<int:page_id>/attachments', methods=['POST'])
@jwt_required()
def upload_attachment(wiki_id, page_id):
    """Upload a file attachment to a page."""
    current_user_id = int(get_jwt_identity())
    page, error = check_page_access(wiki_id, page_id, current_user_id, require_edit=True)
    
    if error:
        status = 404 if 'not found' in error else 403
        return jsonify({'error': error}), status
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Secure the filename and generate a unique stored name
    original_filename = secure_filename(file.filename)
    extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
    stored_filename = f"{uuid.uuid4().hex}.{extension}" if extension else uuid.uuid4().hex
    
    # Create upload directory structure: uploads/wiki_id/page_id/
    upload_base = current_app.config['UPLOAD_FOLDER']
    upload_dir = os.path.join(upload_base, str(wiki_id), str(page_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, stored_filename)
    file.save(file_path)
    
    # Get file info
    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or 'application/octet-stream'
    file_type = get_file_type(mime_type, extension)
    
    attachment = Attachment(
        filename=original_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        file_type=file_type,
        page_id=page_id,
        uploaded_by_id=current_user_id
    )
    
    db.session.add(attachment)
    db.session.commit()
    
    return jsonify({
        'message': 'File uploaded successfully',
        'attachment': attachment.to_dict()
    }), 201


@attachments_bp.route('/api/attachments/<int:attachment_id>', methods=['GET'])
@jwt_required()
def get_attachment_info(attachment_id):
    """Get attachment metadata."""
    current_user_id = int(get_jwt_identity())
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    page = attachment.page
    _, error = check_page_access(page.wiki_id, page.id, current_user_id)
    
    if error:
        return jsonify({'error': error}), 403
    
    return jsonify({'attachment': attachment.to_dict()}), 200


@attachments_bp.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
@jwt_required()
def download_attachment(attachment_id):
    """Download an attachment file."""
    current_user_id = int(get_jwt_identity())
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    page = attachment.page
    _, error = check_page_access(page.wiki_id, page.id, current_user_id)
    
    if error:
        return jsonify({'error': error}), 403
    
    if not os.path.exists(attachment.file_path):
        return jsonify({'error': 'File not found on server'}), 404
    
    return send_file(
        attachment.file_path,
        download_name=attachment.filename,
        mimetype=attachment.mime_type,
        as_attachment=True
    )


@attachments_bp.route('/api/attachments/<int:attachment_id>/view', methods=['GET'])
@jwt_required()
def view_attachment(attachment_id):
    """View an attachment inline (for images, PDFs, etc.)."""
    current_user_id = int(get_jwt_identity())
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    page = attachment.page
    _, error = check_page_access(page.wiki_id, page.id, current_user_id)
    
    if error:
        return jsonify({'error': error}), 403
    
    if not os.path.exists(attachment.file_path):
        return jsonify({'error': 'File not found on server'}), 404
    
    return send_file(
        attachment.file_path,
        download_name=attachment.filename,
        mimetype=attachment.mime_type,
        as_attachment=False  # Inline display
    )


@attachments_bp.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(attachment_id):
    """Delete an attachment."""
    current_user_id = int(get_jwt_identity())
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    page = attachment.page
    _, error = check_page_access(page.wiki_id, page.id, current_user_id, require_edit=True)
    
    if error:
        return jsonify({'error': error}), 403
    
    # Delete the file from disk
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)
    
    db.session.delete(attachment)
    db.session.commit()
    
    return jsonify({'message': 'Attachment deleted successfully'}), 200


# Special endpoint for editor image uploads (drag-and-drop)
@attachments_bp.route('/api/wikis/<int:wiki_id>/pages/<int:page_id>/upload-image', methods=['POST'])
@jwt_required()
def upload_editor_image(wiki_id, page_id):
    """
    Upload an image from the markdown editor.
    Returns URL that can be embedded in markdown.
    """
    current_user_id = int(get_jwt_identity())
    page, error = check_page_access(wiki_id, page_id, current_user_id, require_edit=True)
    
    if error:
        status = 404 if 'not found' in error else 403
        return jsonify({'error': error}), status
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Only allow images for this endpoint
    original_filename = secure_filename(file.filename)
    extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
    
    allowed_images = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
    if extension not in allowed_images:
        return jsonify({'error': 'Only image files are allowed'}), 400
    
    stored_filename = f"{uuid.uuid4().hex}.{extension}"
    
    upload_base = current_app.config['UPLOAD_FOLDER']
    upload_dir = os.path.join(upload_base, str(wiki_id), str(page_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, stored_filename)
    file.save(file_path)
    
    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or 'image/png'
    
    attachment = Attachment(
        filename=original_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        file_type='image',
        page_id=page_id,
        uploaded_by_id=current_user_id
    )
    
    db.session.add(attachment)
    db.session.commit()
    
    # Return URL for embedding in markdown
    return jsonify({
        'success': True,
        'url': f'/api/attachments/{attachment.id}/view',
        'attachment': attachment.to_dict()
    }), 201
