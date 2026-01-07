import { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { Save, UserPlus, Trash2, X } from 'lucide-react';
import { wikisAPI, searchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function WikiSettings() {
  const { wikiId } = useParams();
  const { wiki } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false
  });
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  
  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (wiki) {
      setFormData({
        name: wiki.name,
        description: wiki.description || '',
        is_public: wiki.is_public
      });
    }
    loadMembers();
  }, [wiki]);

  const loadMembers = async () => {
    try {
      const response = await wikisAPI.listMembers(wikiId);
      setOwner(response.data.owner);
      setMembers(response.data.members);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await wikisAPI.update(wikiId, formData);
      alert('Settings saved successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchUsers = async (query) => {
    setUserSearch(query);
    if (query.length < 2) {
      setUserResults([]);
      return;
    }

    try {
      const response = await searchAPI.searchUsers(query);
      // Filter out existing members and owner
      const existingIds = [owner?.id, ...members.map(m => m.id)];
      setUserResults(response.data.users.filter(u => !existingIds.includes(u.id)));
    } catch (err) {
      console.error('User search failed:', err);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) return;

    setAddingMember(true);
    try {
      await wikisAPI.addMember(wikiId, {
        user_id: selectedUser.id,
        role: newMemberRole
      });
      await loadMembers();
      setShowAddMember(false);
      setSelectedUser(null);
      setUserSearch('');
      setUserResults([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (userId, role) => {
    try {
      await wikisAPI.updateMember(wikiId, userId, { role });
      setMembers(members.map(m => 
        m.id === userId ? { ...m, role } : m
      ));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member from the wiki?')) return;

    try {
      await wikisAPI.removeMember(wikiId, userId);
      setMembers(members.filter(m => m.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteWiki = async () => {
    if (!confirm('Are you sure you want to delete this wiki? This action cannot be undone.')) {
      return;
    }

    try {
      await wikisAPI.delete(wikiId);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete wiki');
    }
  };

  const isOwner = owner?.id === user?.id;

  return (
    <div className="page-content">
      <h1 className="page-title mb-6">Wiki Settings</h1>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="font-semibold">General Settings</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Wiki Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              />
              <span>Make this wiki public</span>
            </label>
            <p className="text-xs text-secondary mt-1">
              Public wikis can be viewed by anyone with the link
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 className="font-semibold">Members</h3>
          {isOwner && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddMember(true)}
            >
              <UserPlus size={16} />
              Add Member
            </button>
          )}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loadingMembers ? (
            <div className="loading-container">
              <div className="spinner" />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500 }}>User</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500 }}>Role</th>
                  {isOwner && (
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500 }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {owner && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div className="font-medium">{owner.display_name || owner.username}</div>
                      <div className="text-xs text-secondary">@{owner.username}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="text-sm" style={{ 
                        background: 'var(--primary)', 
                        color: 'white',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem'
                      }}>
                        Owner
                      </span>
                    </td>
                    {isOwner && <td></td>}
                  </tr>
                )}
                {members.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div className="font-medium">{member.display_name || member.username}</div>
                      <div className="text-xs text-secondary">@{member.username}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {isOwner ? (
                        <select
                          className="form-input"
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                          style={{ width: 'auto', fontSize: '0.875rem' }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-sm capitalize">{member.role}</span>
                      )}
                    </td>
                    {isOwner && (
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div className="card-header">
            <h3 className="font-semibold text-danger">Danger Zone</h3>
          </div>
          <div className="card-body">
            <p className="text-sm text-secondary mb-4">
              Once you delete a wiki, there is no going back. All pages and attachments will be permanently deleted.
            </p>
            <button
              className="btn btn-danger"
              onClick={handleDeleteWiki}
            >
              <Trash2 size={16} />
              Delete Wiki
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => {
          setShowAddMember(false);
          setSelectedUser(null);
          setUserSearch('');
          setUserResults([]);
        }}
        title="Add Member"
        footer={
          <>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowAddMember(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleAddMember}
              disabled={!selectedUser || addingMember}
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Search Users</label>
          <input
            type="text"
            className="form-input"
            value={userSearch}
            onChange={(e) => handleSearchUsers(e.target.value)}
            placeholder="Search by username..."
          />
          
          {userResults.length > 0 && (
            <ul style={{ 
              listStyle: 'none', 
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              marginTop: '0.5rem',
              maxHeight: 200,
              overflow: 'auto'
            }}>
              {userResults.map(u => (
                <li 
                  key={u.id}
                  className={`p-2 cursor-pointer ${selectedUser?.id === u.id ? 'bg-primary text-white' : ''}`}
                  style={{ 
                    background: selectedUser?.id === u.id ? 'var(--primary)' : undefined,
                    color: selectedUser?.id === u.id ? 'white' : undefined
                  }}
                  onClick={() => setSelectedUser(u)}
                >
                  <div className="font-medium">{u.display_name || u.username}</div>
                  <div className="text-xs" style={{ opacity: 0.7 }}>@{u.username}</div>
                </li>
              ))}
            </ul>
          )}
          
          {selectedUser && (
            <div className="mt-2 p-2 rounded" style={{ background: 'var(--background)' }}>
              Selected: <strong>{selectedUser.display_name || selectedUser.username}</strong>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Role</label>
          <select
            className="form-input"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
          >
            <option value="viewer">Viewer - Can view pages</option>
            <option value="editor">Editor - Can edit pages</option>
            <option value="admin">Admin - Can manage members</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
