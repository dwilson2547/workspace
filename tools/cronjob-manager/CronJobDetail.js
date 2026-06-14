import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import './CronJobDetail.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function CronJobDetail() {
  const { namespace, name } = useParams();
  const [cronJob, setCronJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    fetchCronJobDetails();
    fetchHistory();
  }, [namespace, name]);

  const fetchCronJobDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cronjobs/${namespace}/${name}`);
      setCronJob(response.data);
    } catch (err) {
      setError('Failed to fetch CronJob details: ' + (err.response?.data?.detail || err.message));
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/cronjobs/${namespace}/${name}/history`);
      setHistory(response.data);
    } catch (err) {
      setError('Failed to fetch execution history: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (jobName = null) => {
    try {
      setLogs({ loading: true });
      const url = jobName 
        ? `${API_URL}/api/cronjobs/${namespace}/${name}/logs?job_name=${jobName}`
        : `${API_URL}/api/cronjobs/${namespace}/${name}/logs`;
      
      const response = await axios.get(url);
      setLogs(response.data);
      setSelectedJob(jobName);
    } catch (err) {
      setLogs({ 
        error: 'Failed to fetch logs: ' + (err.response?.data?.detail || err.message) 
      });
    }
  };

  if (loading) {
    return <div className="loading">Loading CronJob details...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <Link to="/" className="btn">Back to List</Link>
      </div>
    );
  }

  return (
    <div className="cronjob-detail">
      <div className="detail-header">
        <div>
          <h2>{name}</h2>
          <p className="namespace-badge">Namespace: {namespace}</p>
        </div>
        <div className="header-actions">
          <Link to={`/edit/${namespace}/${name}`} className="btn btn-primary">
            Edit
          </Link>
          <Link to="/" className="btn btn-secondary">
            Back to List
          </Link>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => setActiveTab('info')}
        >
          Information
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Execution History
        </button>
        <button 
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => {
            setActiveTab('logs');
            if (!logs) fetchLogs();
          }}
        >
          Logs
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'info' && cronJob && (
          <div className="info-section">
            <div className="info-grid">
              <div className="info-item">
                <label>Schedule</label>
                <code>{cronJob.schedule}</code>
              </div>
              <div className="info-item">
                <label>Status</label>
                <span className={`status ${cronJob.suspend ? 'suspended' : 'active'}`}>
                  {cronJob.suspend ? 'Suspended' : 'Active'}
                </span>
              </div>
              <div className="info-item">
                <label>Last Schedule Time</label>
                <span>
                  {cronJob.last_schedule_time 
                    ? new Date(cronJob.last_schedule_time).toLocaleString() 
                    : 'Never'}
                </span>
              </div>
              <div className="info-item">
                <label>Active Jobs</label>
                <span>{cronJob.active}</span>
              </div>
              <div className="info-item">
                <label>Concurrency Policy</label>
                <span>{cronJob.concurrency_policy}</span>
              </div>
              <div className="info-item">
                <label>Created</label>
                <span>{new Date(cronJob.created).toLocaleString()}</span>
              </div>
            </div>

            <div className="info-section">
              <h3>Container Configuration</h3>
              <div className="info-item">
                <label>Image</label>
                <code>{cronJob.image}</code>
              </div>
              {cronJob.command && cronJob.command.length > 0 && (
                <div className="info-item">
                  <label>Command</label>
                  <code>{cronJob.command.join(' ')}</code>
                </div>
              )}
              {cronJob.args && cronJob.args.length > 0 && (
                <div className="info-item">
                  <label>Arguments</label>
                  <code>{cronJob.args.join(' ')}</code>
                </div>
              )}
            </div>

            <div className="info-section">
              <h3>Job History Limits</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Successful Jobs Limit</label>
                  <span>{cronJob.successful_jobs_history_limit}</span>
                </div>
                <div className="info-item">
                  <label>Failed Jobs Limit</label>
                  <span>{cronJob.failed_jobs_history_limit}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <h3>Execution History</h3>
            {history.length === 0 ? (
              <p className="empty-state">No job executions yet</p>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Status</th>
                    <th>Start Time</th>
                    <th>Completion Time</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((job) => {
                    const duration = job.start_time && job.completion_time
                      ? ((new Date(job.completion_time) - new Date(job.start_time)) / 1000).toFixed(0) + 's'
                      : '-';
                    
                    return (
                      <tr key={job.name}>
                        <td><code>{job.name}</code></td>
                        <td>
                          <span className={`job-status status-${job.status.toLowerCase()}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>
                          {job.start_time 
                            ? new Date(job.start_time).toLocaleString() 
                            : '-'}
                        </td>
                        <td>
                          {job.completion_time 
                            ? new Date(job.completion_time).toLocaleString() 
                            : '-'}
                        </td>
                        <td>{duration}</td>
                        <td>
                          <button
                            onClick={() => {
                              setActiveTab('logs');
                              fetchLogs(job.name);
                            }}
                            className="btn btn-small"
                          >
                            View Logs
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-section">
            <div className="logs-header">
              <h3>Job Logs</h3>
              {!logs && (
                <button onClick={() => fetchLogs()} className="btn btn-primary">
                  Load Latest Logs
                </button>
              )}
            </div>

            {logs && logs.loading && <div className="loading">Loading logs...</div>}
            
            {logs && logs.error && <div className="error">{logs.error}</div>}
            
            {logs && logs.logs && (
              <div>
                <div className="logs-meta">
                  <span><strong>Job:</strong> {logs.job_name}</span>
                  {logs.pod_name && <span><strong>Pod:</strong> {logs.pod_name}</span>}
                </div>
                <pre className="logs-content">{logs.logs}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CronJobDetail;
