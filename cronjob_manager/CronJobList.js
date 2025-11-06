import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CronJobList.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function CronJobList() {
  const [cronJobs, setCronJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [namespace, setNamespace] = useState('default');

  useEffect(() => {
    fetchCronJobs();
  }, [namespace]);

  const fetchCronJobs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/cronjobs?namespace=${namespace}`);
      setCronJobs(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch CronJobs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (namespace, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/cronjobs/${namespace}/${name}`);
      fetchCronJobs();
    } catch (err) {
      alert('Failed to delete CronJob: ' + (err.response?.data?.detail || err.message));
    }
  };

  const toggleSuspend = async (namespace, name, currentSuspend) => {
    try {
      await axios.put(`${API_URL}/api/cronjobs/${namespace}/${name}`, {
        suspend: !currentSuspend
      });
      fetchCronJobs();
    } catch (err) {
      alert('Failed to update CronJob: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return <div className="loading">Loading CronJobs...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="cronjob-list">
      <div className="list-header">
        <h2>CronJobs</h2>
        <div className="namespace-selector">
          <label>Namespace: </label>
          <input 
            type="text" 
            value={namespace} 
            onChange={(e) => setNamespace(e.target.value)}
            placeholder="default"
          />
        </div>
      </div>

      {cronJobs.length === 0 ? (
        <div className="empty-state">
          <p>No CronJobs found in namespace "{namespace}"</p>
          <Link to="/create" className="btn btn-primary">Create your first CronJob</Link>
        </div>
      ) : (
        <table className="cronjob-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Schedule</th>
              <th>Suspend</th>
              <th>Last Schedule</th>
              <th>Active</th>
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cronJobs.map((cj) => (
              <tr key={`${cj.namespace}-${cj.name}`}>
                <td>
                  <Link to={`/cronjob/${cj.namespace}/${cj.name}`}>
                    {cj.name}
                  </Link>
                </td>
                <td><code>{cj.schedule}</code></td>
                <td>
                  <span className={`status ${cj.suspend ? 'suspended' : 'active'}`}>
                    {cj.suspend ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>{cj.last_schedule_time ? new Date(cj.last_schedule_time).toLocaleString() : 'Never'}</td>
                <td>{cj.active}</td>
                <td><code>{cj.image}</code></td>
                <td className="actions">
                  <button 
                    onClick={() => toggleSuspend(cj.namespace, cj.name, cj.suspend)}
                    className="btn btn-small"
                    title={cj.suspend ? 'Resume' : 'Suspend'}
                  >
                    {cj.suspend ? '▶️' : '⏸️'}
                  </button>
                  <Link 
                    to={`/edit/${cj.namespace}/${cj.name}`}
                    className="btn btn-small"
                    title="Edit"
                  >
                    ✏️
                  </Link>
                  <button 
                    onClick={() => handleDelete(cj.namespace, cj.name)}
                    className="btn btn-small btn-danger"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default CronJobList;
