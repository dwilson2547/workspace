# AI-Powered Wiki Application

A Flask-based wiki application with user management, hierarchical pages, file attachments, and designed for future AI-powered features like semantic search and auto-linking.

## Features

- **User Management**: Registration, authentication with JWT, role-based permissions
- **Multiple Wikis**: Users can create and manage multiple wikis
- **Hierarchical Pages**: Pages can have parent-child relationships
- **File Attachments**: Upload images and documents to pages
- **Revision History**: Track changes with ability to restore previous versions
- **Collaboration**: Share wikis with team members (viewer, editor, admin roles)
- **Search**: Basic keyword search (ready for semantic search enhancement)

## Tech Stack

- **Backend**: Flask, SQLAlchemy, Flask-JWT-Extended
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Authentication**: JWT with access/refresh tokens

## Quick Start

### 1. Setup Environment

```bash
cd wiki-app
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Initialize Database

```bash
flask init-db
# Or with migrations:
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

### 4. Seed Demo Data (Optional)

```bash
flask seed-demo
```

### 5. Run the Server

```bash
python run.py
# Or: flask run
```

Server runs at `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |
| POST | `/api/auth/change-password` | Change password |

### Wikis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wikis` | List user's wikis |
| POST | `/api/wikis` | Create wiki |
| GET | `/api/wikis/:id` | Get wiki |
| PATCH | `/api/wikis/:id` | Update wiki |
| DELETE | `/api/wikis/:id` | Delete wiki |
| GET | `/api/wikis/:id/members` | List members |
| POST | `/api/wikis/:id/members` | Add member |
| PATCH | `/api/wikis/:id/members/:uid` | Update member role |
| DELETE | `/api/wikis/:id/members/:uid` | Remove member |

### Pages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wikis/:id/pages` | List pages (flat or tree) |
| POST | `/api/wikis/:id/pages` | Create page |
| GET | `/api/wikis/:id/pages/:pid` | Get page |
| GET | `/api/wikis/:id/pages/by-path/:path` | Get page by path |
| PATCH | `/api/wikis/:id/pages/:pid` | Update page |
| DELETE | `/api/wikis/:id/pages/:pid` | Delete page |
| POST | `/api/wikis/:id/pages/:pid/move` | Move page |
| GET | `/api/wikis/:id/pages/:pid/children` | Get children |
| GET | `/api/wikis/:id/pages/:pid/revisions` | Get revisions |
| POST | `/api/wikis/:id/pages/:pid/restore/:rid` | Restore revision |

### Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wikis/:wid/pages/:pid/attachments` | List attachments |
| POST | `/api/wikis/:wid/pages/:pid/attachments` | Upload file |
| POST | `/api/wikis/:wid/pages/:pid/upload-image` | Upload image (editor) |
| GET | `/api/attachments/:id` | Get attachment info |
| GET | `/api/attachments/:id/download` | Download file |
| GET | `/api/attachments/:id/view` | View inline |
| DELETE | `/api/attachments/:id` | Delete attachment |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search/pages?q=...` | Search all pages |
| GET | `/api/search/wikis/:id/pages?q=...` | Search wiki pages |
| GET | `/api/search/users?q=...` | Search users |

## API Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"securepass123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"securepass123"}'
```

### Create Wiki (with token)
```bash
curl -X POST http://localhost:5000/api/wikis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"name":"My Knowledge Base","description":"Personal notes"}'
```

### Create Page
```bash
curl -X POST http://localhost:5000/api/wikis/1/pages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"title":"Getting Started","content":"# Welcome\n\nThis is my first page."}'
```

### Create Child Page
```bash
curl -X POST http://localhost:5000/api/wikis/1/pages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"title":"Sub Topic","content":"Details here...","parent_id":1}'
```

### Upload Image
```bash
curl -X POST http://localhost:5000/api/wikis/1/pages/1/upload-image \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/image.png"
```

## Frontend Integration

### Recommended Markdown Editors

1. **Toast UI Editor** - Full-featured WYSIWYG + markdown
   ```bash
   npm install @toast-ui/editor
   ```

2. **Milkdown** - Modern, plugin-based
   ```bash
   npm install @milkdown/core @milkdown/preset-commonmark
   ```

### Editor Image Upload Integration

Both editors support custom image upload handlers. Use the `/upload-image` endpoint:

```javascript
// Toast UI Editor example
const editor = new Editor({
  hooks: {
    addImageBlobHook: async (blob, callback) => {
      const formData = new FormData();
      formData.append('file', blob);
      
      const response = await fetch(
        `/api/wikis/${wikiId}/pages/${pageId}/upload-image`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      
      const data = await response.json();
      callback(data.url, 'uploaded image');
    }
  }
});
```

## Project Structure

```
wiki-app/
├── app/
│   ├── __init__.py          # App factory
│   ├── config.py            # Configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # SQLAlchemy models
│   └── routes/
│       ├── __init__.py
│       ├── auth.py          # Authentication
│       ├── wikis.py         # Wiki CRUD
│       ├── pages.py         # Page CRUD
│       ├── attachments.py   # File handling
│       └── search.py        # Search functionality
├── uploads/                  # File uploads directory
├── requirements.txt
├── run.py                   # Entry point
└── .env.example
```

## Future Enhancements

This backend is designed to support AI features:

1. **Semantic Search**: Add vector embeddings to pages for concept-based search
2. **Auto-Linking**: Use embeddings + LLM to suggest links between pages
3. **Page Suggestions**: Analyze content gaps and suggest new topics
4. **Smart Summaries**: Auto-generate page summaries

To add these features, you would:
1. Add a vector column to the Page model (using pgvector)
2. Generate embeddings on page create/update
3. Add semantic search endpoints
4. Add AI suggestion endpoints

## License

MIT
