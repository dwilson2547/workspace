import { useState, useEffect, useRef } from 'react';
import { useParams, useOutletContext, useNavigate, Link } from 'react-router-dom';
import { Save, X, ChevronRight, Upload, Paperclip, Trash2 } from 'lucide-react';
import { pagesAPI, attachmentsAPI } from '../services/api';
import MarkdownEditor from '../components/MarkdownEditor';
import TagManager from '../components/TagManager';

export default function PageEdit() {
  const { wikiId, pageId } = useParams();
  const { wiki, pages, refreshPages } = useOutletContext();
  const navigate = useNavigate();
  
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [parentId, setParentId] = useState(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const response = await pagesAPI.get(wikiId, pageId);
      const pageData = response.data.page;
      setPage(pageData);
      setTitle(pageData.title);
      setContent(pageData.content || '');
      setSummary(pageData.summary || '');
      setParentId(pageData.parent_id);
      
      const attachRes = await attachmentsAPI.list(wikiId, pageId);
      setAttachments(attachRes.data.attachments);
    } catch (err) {
      console.error('Failed to load page:', err);
      navigate(`/wiki/${wikiId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await pagesAPI.update(wikiId, pageId, {
        title,
        content,
        summary,
        parent_id: parentId,
        change_summary: changeSummary || 'Content updated'
      });
      
      await refreshPages();
      navigate(`/wiki/${wikiId}/page/${pageId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await attachmentsAPI.upload(wikiId, pageId, file);
      setAttachments([...attachments, response.data.attachment]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Delete this attachment?')) return;

    try {
      await attachmentsAPI.delete(attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete attachment');
    }
  };

  const flattenPages = (pageList, level = 0, excludeId = null) => {
    let result = [];
    for (const p of pageList) {
      if (p.id === excludeId) continue;
      result.push({ ...p, level });
      if (p.children) {
        result = result.concat(flattenPages(p.children, level + 1, excludeId));
      }
    }
    return result;
  };
  
  const flatPages = flattenPages(pages, 0, parseInt(pageId));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        padding: '0.75rem 1.5rem', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div className="flex items-center gap-4 flex-1">
          <button 
            className="btn btn-ghost"
            onClick={() => navigate(`/wiki/${wikiId}/page/${pageId}`)}
          >
            <X size={18} />
            Cancel
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, maxWidth: 600 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="form-input"
              style={{ fontSize: '1.25rem', fontWeight: 600 }}
            />
            {page && (
              <TagManager
                wikiId={wikiId}
                pageId={pageId}
                initialTags={page.tags || []}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowAttachments(true)}
          >
            <Paperclip size={16} />
            Attachments ({attachments.length})
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MarkdownEditor
          ref={editorRef}
          wikiId={parseInt(wikiId)}
          pageId={parseInt(pageId)}
          initialValue={content}
          onChange={setContent}
          height="100%"
          placeholder="Start writing your page content..."
        />
      </div>

      {/* Footer with metadata */}
      <footer style={{ 
        padding: '0.75rem 1.5rem', 
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: 300 }}>
          <label className="text-xs text-secondary mb-1" style={{ display: 'block' }}>
            Parent Page
          </label>
          <select
            className="form-input"
            value={parentId || ''}
            onChange={(e) => setParentId(e.target.value ? parseInt(e.target.value) : null)}
            style={{ fontSize: '0.875rem' }}
          >
            <option value="">None (top level)</option>
            {flatPages.map(p => (
              <option key={p.id} value={p.id}>
                {'  '.repeat(p.level)}{p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: 300 }}>
          <label className="text-xs text-secondary mb-1" style={{ display: 'block' }}>
            Summary (for search)
          </label>
          <input
            type="text"
            className="form-input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief description"
            style={{ fontSize: '0.875rem' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: 300 }}>
          <label className="text-xs text-secondary mb-1" style={{ display: 'block' }}>
            Change Summary
          </label>
          <input
            type="text"
            className="form-input"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What did you change?"
            style={{ fontSize: '0.875rem' }}
          />
        </div>
      </footer>

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
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button 
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={16} />
                  {uploading ? 'Uploading...' : 'Upload File'}
                </button>
                <p className="text-xs text-secondary mt-2">
                  Tip: You can also paste images directly into the editor (Ctrl+V)
                </p>
              </div>

              {attachments.length === 0 ? (
                <p className="text-secondary text-center py-4">No attachments yet</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between py-2" 
                        style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <Paperclip size={16} className="text-secondary" />
                        <div>
                          <div>{att.filename}</div>
                          <div className="text-xs text-secondary">
                            {Math.round(att.file_size / 1024)}KB • {att.file_type}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {att.file_type === 'image' && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              const url = `/api/attachments/${att.id}/view`;
                              const markdown = `![${att.filename}](${url})`;
                              if (editorRef.current?.insertText) {
                                editorRef.current.insertText('\n' + markdown + '\n');
                              }
                              setShowAttachments(false);
                            }}
                          >
                            Insert
                          </button>
                        )}
                        {att.file_type !== 'image' && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              const url = `/api/attachments/${att.id}/download`;
                              const markdown = `[${att.filename}](${url})`;
                              if (editorRef.current?.insertText) {
                                editorRef.current.insertText('\n' + markdown + '\n');
                              }
                              setShowAttachments(false);
                            }}
                          >
                            Insert
                          </button>
                        )}
                        <a 
                          href={attachmentsAPI.getDownloadUrl(att.id)}
                          className="btn btn-sm btn-secondary"
                          download
                        >
                          Download
                        </a>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
