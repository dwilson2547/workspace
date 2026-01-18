from .auth import auth_bp
from .wikis import wikis_bp
from .pages import pages_bp
from .attachments import attachments_bp
from .search import search_bp
from .semantic_search import semantic_search_bp

__all__ = ['auth_bp', 'wikis_bp', 'pages_bp', 'attachments_bp', 'search_bp', 'semantic_search_bp']
