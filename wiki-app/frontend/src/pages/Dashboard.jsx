import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Book, Lock, Globe, MoreVertical, Trash2, Settings } from 'lucide-react';
import { wikisAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Search from '../components/Search';

export default function Dashboard() {
  const [wikis, setWikis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWiki, setNewWiki] = useState({ name: '', description: '', is_public: false });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadWikis();
  }, []);

  const loadWikis = async () => {
    try {
      const response = await wikisAPI.list();
      setWikis(response.data.wikis);
    } catch (err) {
      console.error('Failed to load wikis:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWiki = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const response = await wikisAPI.create(newWiki);
      setWikis([...wikis, response.data.wiki]);
      setShowCreateModal(false);
      setNewWiki({ name: '', description: '', is_public: false });
      navigate(`/wiki/${response.data.wiki.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create wiki');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWiki = async (wikiId) => {
    if (!confirm('Are you sure you want to delete this wiki? All pages will be deleted.')) {
      return;
    }

    try {
      await wikisAPI.delete(wikiId);
      setWikis(wikis.filter(w => w.id !== wikiId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete wiki');
    }
    setDropdownOpen(null);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>My Wikis</h1>
          <p className="text-secondary text-sm">
            Welcome back, {user?.display_name || user?.username}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            New Wiki
          </button>
        </div>
      </header>

      <div className="mb-6" style={{ maxWidth: 400 }}>
        <Search placeholder="Search across all wikis..." />
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
        </div>
      ) : wikis.length === 0 ? (
        <div className="empty-state">
          <Book size={48} className="empty-state-icon" style={{ margin: '0 auto' }} />
          <h3 className="font-semibold mb-2">No wikis yet</h3>
          <p className="text-secondary mb-4">Create your first wiki to get started</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            Create Wiki
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1rem' 
        }}>
          {wikis.map(wiki => (
            <div key={wiki.id} className="wiki-card">
              <div className="flex justify-between items-start mb-2">
                <Link 
                  to={`/wiki/${wiki.id}`}
                  className="wiki-card-title"
                  style={{ color: 'var(--text)', textDecoration: 'none' }}
                >
                  {wiki.name}
                </Link>
                <div className="dropdown">
                  <button 
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setDropdownOpen(dropdownOpen === wiki.id ? null : wiki.id)}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {dropdownOpen === wiki.id && (
                    <div className="dropdown-menu">
                      <Link 
                        to={`/wiki/${wiki.id}/settings`}
                        className="dropdown-item flex items-center gap-2"
                        onClick={() => setDropdownOpen(null)}
                      >
                        <Settings size={14} />
                        Settings
                      </Link>
                      <button 
                        className="dropdown-item dropdown-item-danger flex items-center gap-2"
                        onClick={() => handleDeleteWiki(wiki.id)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="wiki-card-description">
                {wiki.description || 'No description'}
              </p>
              <div className="flex items-center gap-2 text-xs text-secondary">
                {wiki.is_public ? (
                  <>
                    <Globe size={14} />
                    <span>Public</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Private</span>
                  </>
                )}
                <span>•</span>
                <span>Created {new Date(wiki.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Wiki"
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
              onClick={handleCreateWiki}
              disabled={creating || !newWiki.name.trim()}
            >
              {creating ? 'Creating...' : 'Create Wiki'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleCreateWiki}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-input"
              value={newWiki.name}
              onChange={(e) => setNewWiki({ ...newWiki, name: e.target.value })}
              placeholder="My Knowledge Base"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-input"
              value={newWiki.description}
              onChange={(e) => setNewWiki({ ...newWiki, description: e.target.value })}
              placeholder="What is this wiki about?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newWiki.is_public}
                onChange={(e) => setNewWiki({ ...newWiki, is_public: e.target.checked })}
              />
              <span className="text-sm">Make this wiki public</span>
            </label>
            <p className="text-xs text-secondary mt-1">
              Public wikis can be viewed by anyone with the link
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
