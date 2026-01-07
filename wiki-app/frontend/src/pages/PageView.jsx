import { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  Edit, Trash2, Clock, User, ChevronRight, 
  Paperclip, History, MoreVertical, FileText 
} from 'lucide-react';
import { pagesAPI, attachmentsAPI } from '../services/api';
import { Viewer } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor-viewer.css';

export default function PageView() {
  const { wikiId, pageId } = useParams();
  const { wiki, refreshPages } = useOutletContext();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const response = await pagesAPI.get(wikiId, pageId, true);
      setPage(response.data.page);
      
      // Load attachments
      const attachRes = await attachmentsAPI.list(wikiId, pageId);
      setAttachments(attachRes.data.attachments);
    } catch (err) {
      console.error('Failed to load page:', err);
      if (err.response?.status === 404) {
        navigate(`/wiki/${wikiId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRevisions = async () => {
    try {
      const response = await pagesAPI.getRevisions(wikiId, pageId);
      setRevisions(response.data.revisions);
      setShowRevisions(true);
    } catch (err) {
      console.error('Failed to load revisions:', err);
    }
  };

  const handleDelete = async () => {
    const childCount = page.children?.length || 0;
    const message = childCount > 0
      ? `This page has ${childCount} child page(s). Delete this page and all children?`
      : 'Are you sure you want to delete this page?';
    
    if (!confirm(message)) return;

    try {
      await pagesAPI.delete(wikiId, pageId);
      await refreshPages();
      navigate(`/wiki/${wikiId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete page');
    }
  };

  const handleRestoreRevision = async (revisionId) => {
    if (!confirm('Restore this revision? Current content will be saved as a new revision.')) {
      return;
    }

    try {
      await pagesAPI.restoreRevision(wikiId, pageId, revisionId);
      await loadPage();
      setShowRevisions(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restore revision');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 className="font-semibold">Page not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Breadcrumbs */}
      <nav className="breadcrumbs">
        <Link to={`/wiki/${wikiId}`}>{wiki?.name}</Link>
        {page.breadcrumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-2">
            <ChevronRight size={14} className="breadcrumbs-separator" />
            {index === page.breadcrumbs.length - 1 ? (
              <span>{crumb.title}</span>
            ) : (
              <Link to={`/wiki/${wikiId}/page/${crumb.id}`}>{crumb.title}</Link>
            )}
          </span>
        ))}
      </nav>

      {/* Page Header */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <h1 className="page-title">{page.title}</h1>
          
          <div className="flex gap-2">
            <Link 
              to={`/wiki/${wikiId}/page/${pageId}/edit`}
              className="btn btn-primary"
            >
              <Edit size={16} />
              Edit
            </Link>
            
            <div className="dropdown">
              <button 
                className="btn btn-secondary btn-icon"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <MoreVertical size={16} />
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <button 
                    className="dropdown-item flex items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      loadRevisions();
                    }}
                  >
                    <History size={14} />
                    View History
                  </button>
                  <button 
                    className="dropdown-item flex items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowAttachments(true);
                    }}
                  >
                    <Paperclip size={14} />
                    Attachments ({attachments.length})
                  </button>
                  <button 
                    className="dropdown-item dropdown-item-danger flex items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleDelete();
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="page-meta flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1">
            <User size={14} />
            {page.last_modified_by?.display_name || page.last_modified_by?.username}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {new Date(page.updated_at).toLocaleString()}
          </span>
          {attachments.length > 0 && (
            <button 
              className="flex items-center gap-1 text-secondary"
              onClick={() => setShowAttachments(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Paperclip size={14} />
              {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="card mt-4">
        <div className="card-body">
          {page.content ? (
            <Viewer initialValue={page.content} />
          ) : (
            <p className="text-secondary text-center py-8">
              This page is empty.{' '}
              <Link to={`/wiki/${wikiId}/page/${pageId}/edit`}>Start editing</Link>
            </p>
          )}
        </div>
      </div>

      {/* Child Pages */}
      {page.children && page.children.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="font-semibold">Child Pages</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <ul style={{ listStyle: 'none' }}>
              {page.children.map(child => (
                <li key={child.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <Link
                    to={`/wiki/${wikiId}/page/${child.id}`}
                    className="flex items-center gap-2 p-3"
                    style={{ color: 'var(--text)', textDecoration: 'none' }}
                  >
                    <FileText size={16} className="text-secondary" />
                    <span>{child.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {showAttachments && (
        <div className="modal-overlay" onClick={() => setShowAttachments(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Attachments</h3>
              <button 
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAttachments(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {attachments.length === 0 ? (
                <p className="text-secondary text-center py-4">No attachments</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between py-2" 
                        style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <Paperclip size={16} className="text-secondary" />
                        <span>{att.filename}</span>
                        <span className="text-xs text-secondary">
                          ({Math.round(att.file_size / 1024)}KB)
                        </span>
                      </div>
                      <a 
                        href={attachmentsAPI.getDownloadUrl(att.id)}
                        className="btn btn-sm btn-secondary"
                        download
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revisions Modal */}
      {showRevisions && (
        <div className="modal-overlay" onClick={() => setShowRevisions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Revision History</h3>
              <button 
                className="btn btn-ghost btn-icon"
                onClick={() => setShowRevisions(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {revisions.length === 0 ? (
                <p className="text-secondary text-center py-4">No revision history</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {revisions.map(rev => (
                    <li key={rev.id} className="flex items-center justify-between py-3" 
                        style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div className="font-medium">Revision {rev.revision_number}</div>
                        <div className="text-sm text-secondary">
                          {rev.created_by?.display_name || rev.created_by?.username} •{' '}
                          {new Date(rev.created_at).toLocaleString()}
                        </div>
                        {rev.change_summary && (
                          <div className="text-sm text-secondary mt-1">
                            {rev.change_summary}
                          </div>
                        )}
                      </div>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleRestoreRevision(rev.id)}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
