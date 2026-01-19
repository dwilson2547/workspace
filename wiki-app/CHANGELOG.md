# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Admin Panel**: Comprehensive administrative interface for platform management
  - User Management: View, search, edit, and deactivate user accounts with pagination
  - Wiki Management: View all wikis (flat or grouped by owner), delete wikis, transfer ownership
  - Embeddings Management: View pages without embeddings, manually trigger embedding generation (individual or bulk)
  - Admin-only access protected by `@require_admin` decorator
  - Consistent UI with adjustable sidebar matching main application design
  - Quick action dashboard with statistics overview

### Fixed
- **Admin Wiki Management Grouping**: Fixed SQL error when grouping wikis by owner in admin panel
  - Issue: User table wasn't joined to query when `group_by=owner` parameter was used
  - Error: `psycopg2.errors.UndefinedTable: missing FROM-clause entry for table "users"`
  - Solution: Added User table join whenever grouping by owner or searching by username
  - Admin can now successfully view wikis organized by their owners

- **Site Admin Access Permissions**: Fixed 403 errors when admins tried to access private wikis
  - Updated all wiki routes to check `user.is_admin` before denying access
  - Admins can now view, edit, and manage any wiki regardless of ownership or membership
  - Updated routes: `get_wiki()`, `update_wiki()`, `list_members()`, `add_member()`, `update_member()`, `remove_member()`
  - Updated `get_accessible_wiki_ids()` in search and semantic search routes to return all wikis for admins
  - Updated bulk import routes to allow admins to import to any wiki
  - Pages routes already had admin support via `check_wiki_access()` function

- **Bulk Import Transaction Management**: Fixed silent failure during wiki creation from archive
  - Wiki objects were being flushed but rolled back on import errors, causing 404 errors after navigation
  - Moved wiki creation inside try block for proper transaction control
  - Removed inappropriate `db.session.rollback()` and `db.session.commit()` calls from `ArchiveImporter` service
  - Transaction lifecycle now properly managed by endpoint layer only
  - Added comprehensive error logging with stack traces for debugging
  
- **Slug Uniqueness in Bulk Import**: Fixed duplicate slug constraint violations during archive import
  - Added automatic unique slug generation with incremental suffixes (`page-1`, `page-2`, etc.)
  - Implemented `_generate_unique_slug()` method in `ArchiveImporter` 
  - Updated `generate_unique_slug()` in pages route to match database constraint
  - Fixed to check wiki-level uniqueness (not parent-level) per `unique_page_slug_per_wiki` constraint
  - Prevents import failures when archive contains files/directories with duplicate names
  
- **Page Map Scope in Archive Import**: Fixed name collision bug in hierarchical imports
  - Changed `page_map` from instance variable to local variable scoped per directory level
  - Prevents cross-contamination when same file/directory names appear in different parts of tree
  - Example: `/tools/3d_scanner/` and `/projects/3d_scanner/` no longer interfere with each other

- **Page Creation Slug Conflicts**: Applied same unique slug generation to standard page creation
  - Manual page creation now auto-generates unique slugs instead of returning 409 errors
  - Page updates with conflicting slugs automatically adjusted to unique values
  - Consistent behavior across all page creation methods (manual, bulk import, API)

- **Anchor Link Navigation**: Fixed table of contents anchor links not working in wiki pages
  - Dynamically generates and assigns IDs to headings in rendered markdown (ToastUI doesn't add them by default)
  - Implements slug generation matching markdown processor conventions (lowercase, hyphenated)
  - Adds click handler for smooth scrolling to heading anchors
  - Compensates for fixed header height with offset calculation to prevent headings from hiding under header
  - Properly updates URL hash on navigation

- **Prism.js Syntax Highlighting Error**: Fixed "Cannot read properties of undefined (reading 'tokenizePlaceholders')" error
  - Added required base dependencies (`prism-clike`, `prism-markup`, `prism-markup-templating`) before language components
  - Ensures proper dependency order for JSX, TSX, PHP, and other templating languages
  - Fixes white screen crash when viewing pages with code blocks
  
- **Dark Mode Theme Support for Editor**: Toast UI Editor and Viewer now properly support dark mode
  - Imported Toast UI dark theme CSS (`toastui-editor-dark.css`)
  - Added theme prop to both Editor and Viewer components
  - Implemented theme context integration for automatic theme switching
  - Added `key` prop to force component remount on theme change for immediate visual update
  - Editor content is now readable in dark mode without requiring page refresh

### Changed
- **Markdown Editor Configuration**: Disabled ToastUI usage statistics to prevent telemetry prompts
  - Added `usageStatistics={false}` to Editor component
  - Added `autofocus={false}` for better UX

### Added
- **Public Home Page**: Created a public-facing landing page that displays all public wikis organized by author
  - Users can browse public wikis without authentication
  - Search functionality to filter wikis
  - Responsive card layout with author avatars and wiki metadata
  - Added `/api/wikis/public` endpoint with pagination and search support

- **AI-Powered Semantic Search**: Full semantic search implementation using locally-run open source models
  - Vector similarity search using PostgreSQL with pgvector extension
  - sentence-transformers/all-MiniLM-L6-v2 model for 384-dimension embeddings
  - Automatic background embedding generation via Redis Queue (RQ) when pages are created or edited
  - Intelligent markdown-aware text chunking for long documents (~400 tokens with 50 token overlap)
  - GPU-accelerated Flask microservice for embedding generation
  - Three search modes: AI Search (semantic only), Hybrid (semantic + keyword), and Traditional (keyword only)
  - Dedicated AI Search page with reusable search component
  - Adjustable search parameters (similarity threshold, hybrid search weight)
  - Rich result cards showing relevance scores and matched content snippets
  
- **User Settings Page**: Comprehensive user settings interface with multiple sections
  - Profile management: Upload/remove avatar, update display name
  - Appearance settings: Light/dark theme toggle
  - Wiki management: View all owned wikis with quick access to edit permissions or delete
  - Danger Zone: Account deletion options (with or without associated wikis)
  
- **User Menu Component**: Replaced static logout buttons with interactive user dropdown menu
  - Displays user avatar or initials
  - Quick access to user settings
  - Theme toggle button
  - Logout option
  - Click-outside detection for smooth UX
  
- **Dark Mode Support**: Full theming system with light and dark mode
  - Theme persistence via localStorage
  - System preference detection
  - CSS custom properties for consistent theming across all components
  - Theme-aware syntax highlighting for code blocks
  
- **Syntax Highlighting**: Integrated Prism.js for code block highlighting in markdown
  - Support for 30+ programming languages (JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, SQL, etc.)
  - Custom theme that adapts to light/dark mode
  - Applied to both markdown editor and page viewer
  - Uses Toast UI Editor plugin for seamless integration
  
- **Account Deletion API**: New `/api/auth/me` DELETE endpoint
  - Option to delete account while preserving wikis
  - Option to cascade delete all owned wikis with account
  
### Changed
- **Unified Header Design**: Standardized header appearance across all pages
  - Dashboard header updated to match public home page style
  - WikiLayout header redesigned with consistent navigation
  - Removed sidebar footer in favor of header-based user menu
  
- **Improved Navigation**: Enhanced user navigation patterns
  - Consistent user menu placement across all authenticated pages
  - Centralized settings access from any page
  - Improved visual hierarchy in headers
  
### Fixed
- **Search Functionality Bug**: Resolved SQLAlchemy TypeError in search endpoint
  - Changed `func.case()` to `case()` by importing it directly from SQLAlchemy
  - Fixed issue where `func.case()` didn't support `else_` parameter
  - Search now properly handles case-insensitive matching across wiki pages

### Technical
- **Test Infrastructure**:
  - Added `test_slug_uniqueness.py`: Comprehensive test for slug generation and database constraints
  - Validates wiki-level uniqueness requirements
  - Tests incremental suffix generation logic
  
- **Dependencies Added**:
  - `@toast-ui/editor-plugin-code-syntax-highlight` for syntax highlighting
  - `prismjs` for code tokenization and highlighting
  - `pgvector` (Python) for PostgreSQL vector operations
  - `sentence-transformers` for embedding model
  - `tiktoken` for token counting and text chunking
  - `rq` (Redis Queue) for background task processing
  
- **Infrastructure**:
  - PostgreSQL 16 with pgvector extension (Docker container)
  - Redis 7 for task queue with persistence (Docker container)
  - Flask embedding microservice on port 8001 with GPU support
  - RQ worker process for background embedding generation
  
- **New Backend Components**:
  - `embedding_service/app.py`: Standalone Flask microservice for GPU-accelerated embeddings
  - `app/models/models.py`: Added `PageEmbedding` model with Vector(384) column
  - `app/services/chunking.py`: `TextChunker` for markdown-aware text splitting
  - `app/services/embeddings.py`: `EmbeddingServiceClient` HTTP client
  - `app/tasks/embedding_tasks.py`: RQ background tasks for embedding generation
  - `app/routes/semantic_search.py`: Semantic and hybrid search endpoints
  - `worker.py`: RQ worker script for processing embedding tasks
  
- **New Frontend Components**:
  - `UserMenu.jsx`: User dropdown menu component
  - `ThemeContext.jsx`: Global theme state management
  - `UserSettings.jsx`: Comprehensive settings page
  - `Home.jsx`: Public wiki explorer page
  - `SemanticSearch.jsx`: Reusable AI search component with mode toggle
  - `SemanticSearchPage.jsx`: Dedicated AI search page at `/search`
  
- **New Stylesheets**:
  - `prism-theme.css`: Theme-aware syntax highlighting styles
  - `semantic-search.css`: Complete styling for AI search components
  - Updated `index.css` with CSS custom properties for theming
  
- **API Endpoints**:
  - `GET /api/wikis/public`: List public wikis grouped by author
  - `DELETE /api/auth/me`: Delete user account with optional wiki cascade
  - `POST /api/search/semantic`: Vector similarity search with configurable threshold
  - `POST /api/search/hybrid`: Combined semantic and keyword search with adjustable weights
  - `POST /embed` (embedding service): Generate embeddings for text batches

---

## [1.0.0] - Initial Release

### Added
- User authentication and authorization with JWT
- Wiki creation and management
- Hierarchical page structure with parent-child relationships
- Rich markdown editor with image upload support
- Page version history and revisions
- File attachments for wiki pages
- Public/private wiki visibility settings
- Collaborative editing with permissions
- Search functionality across wiki pages
- Responsive UI built with React
- RESTful API built with Flask
