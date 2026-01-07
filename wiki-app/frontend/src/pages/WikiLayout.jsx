import { useState, useEffect } from 'react';
import { Outlet, Link, useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Plus, Settings, Home, FileText, 
  Search as SearchIcon, Menu, X 
} from 'lucide-react';
import { wikisAPI, pagesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageTree from '../components/PageTree';
import Search from '../components/Search';
import Modal from '../components/Modal';

export default function WikiLayout() {
  const { wikiId } = useParams();
  const [wiki, setWiki] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPage, setNewPage] = useState({ title: '', parent_id: null });
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadWikiData();
  }, [wikiId]);

  const loadWikiData = async () => {
    setLoading(true);
    try {
      const [wikiRes, pagesRes] = await Promise.all([
        wikisAPI.get(wikiId),
        pagesAPI.list(wikiId, 'tree')
      ]);
      setWiki(wikiRes.data.wiki);
      setPages(pagesRes.data.pages);
    } catch (err) {
      console.error('Failed to load wiki:', err);
      if (err.response?.status === 404) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await pagesAPI.create(wikiId, {
        title: newPage.title,
        parent_id: newPage.parent_id,
        content: ''
      });
      
      // Reload pages to get updated tree
      const pagesRes = await pagesAPI.list(wikiId, 'tree');
      setPages(pagesRes.data.pages);
      
      setShowCreateModal(false);
      setNewPage({ title: '', parent_id: null });
      
      // Navigate to the new page in edit mode
      navigate(`/wiki/${wikiId}/page/${response.data.page.id}/edit`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  const refreshPages = async () => {
    const pagesRes = await pagesAPI.list(wikiId, 'tree');
    setPages(pagesRes.data.pages);
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Flatten pages for parent select
  const flattenPages = (pages, level = 0) => {
    let result = [];
    for (const page of pages) {
      result.push({ ...page, level });
      if (page.children) {
        result = result.concat(flattenPages(page.children, level + 1));
      }
    }
    return result;
  };
  const flatPages = flattenPages(pages);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'hidden'}`} style={{
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease'
      }}>
        <div className="sidebar-header">
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="flex items-center gap-2 text-secondary">
              <ChevronLeft size={16} />
              <span className="text-sm">All Wikis</span>
            </Link>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <h2 className="font-semibold" style={{ fontSize: '1.125rem' }}>
            {wiki?.name}
          </h2>
        </div>

        <div className="px-4 py-2">
          <Search wikiId={wikiId} placeholder="Search pages..." />
        </div>

        <div className="sidebar-content">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary font-medium uppercase">Pages</span>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setShowCreateModal(true)}
              title="New page"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <PageTree pages={pages} wikiId={wikiId} />
        </div>

        <div className="sidebar-footer">
          <Link 
            to={`/wiki/${wikiId}/settings`}
            className="btn btn-ghost w-full justify-start"
          >
            <Settings size={16} />
            Wiki Settings
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{
        marginLeft: sidebarOpen ? '260px' : '0',
        transition: 'margin-left 0.2s ease'
      }}>
        {!sidebarOpen && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(true)}
            style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 40 }}
          >
            <Menu size={20} />
          </button>
        )}
        
        <Outlet context={{ wiki, pages, refreshPages }} />
      </main>

      {/* Create Page Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Page"
        footer={
          <>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleCreatePage}
              disabled={creating || !newPage.title.trim()}
            >
              {creating ? 'Creating...' : 'Create Page'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreatePage}>
          <div className="form-group">
            <label className="form-label">Page Title</label>
            <input
              type="text"
              className="form-input"
              value={newPage.title}
              onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
              placeholder="Getting Started"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Parent Page (optional)</label>
            <select
              className="form-input"
              value={newPage.parent_id || ''}
              onChange={(e) => setNewPage({ 
                ...newPage, 
                parent_id: e.target.value ? parseInt(e.target.value) : null 
              })}
            >
              <option value="">None (top level)</option>
              {flatPages.map(page => (
                <option key={page.id} value={page.id}>
                  {'  '.repeat(page.level)}{page.title}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
