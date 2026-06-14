import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './CronJobForm.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function CronJobForm() {
  const navigate = useNavigate();
  const { namespace: urlNamespace, name: urlName } = useParams();
  const isEdit = !!urlName;

  const [formData, setFormData] = useState({
    name: '',
    namespace: 'default',
    schedule: '*/5 * * * *',
    image: '',
    command: '',
    args: '',
    suspend: false,
    concurrency_policy: 'Allow',
    successful_jobs_history_limit: 3,
    failed_jobs_history_limit: 1
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit) {
      fetchCronJob();
    }
  }, [urlNamespace, urlName]);

  const fetchCronJob = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/cronjobs/${urlNamespace}/${urlName}`);
      const cj = response.data;
      
      setFormData({
        name: cj.name,
        namespace: cj.namespace,
        schedule: cj.schedule,
        image: cj.image,
        command: cj.command ? cj.command.join(' ') : '',
        args: cj.args ? cj.args.join(' ') : '',
        suspend: cj.suspend,
        concurrency_policy: cj.concurrency_policy,
        successful_jobs_history_limit: cj.successful_jobs_history_limit,
        failed_jobs_history_limit: cj.failed_jobs_history_limit
      });
    } catch (err) {
      setError('Failed to fetch CronJob: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        command: formData.command ? formData.command.split(' ').filter(Boolean) : null,
        args: formData.args ? formData.args.split(' ').filter(Boolean) : null,
        successful_jobs_history_limit: parseInt(formData.successful_jobs_history_limit),
        failed_jobs_history_limit: parseInt(formData.failed_jobs_history_limit)
      };

      if (isEdit) {
        // Update existing CronJob
        delete payload.name;
        delete payload.namespace;
        await axios.put(`${API_URL}/api/cronjobs/${urlNamespace}/${urlName}`, payload);
      } else {
        // Create new CronJob
        await axios.post(`${API_URL}/api/cronjobs`, payload);
      }

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div className="loading">Loading CronJob...</div>;
  }

  return (
    <div className="cronjob-form">
      <h2>{isEdit ? `Edit CronJob: ${urlName}` : 'Create New CronJob'}</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={isEdit}
            required
            placeholder="my-cronjob"
          />
          <small>Lowercase alphanumeric characters, '-' or '.'</small>
        </div>

        <div className="form-group">
          <label htmlFor="namespace">Namespace *</label>
          <input
            type="text"
            id="namespace"
            name="namespace"
            value={formData.namespace}
            onChange={handleChange}
            disabled={isEdit}
            required
            placeholder="default"
          />
        </div>

        <div className="form-group">
          <label htmlFor="schedule">Schedule (Cron Expression) *</label>
          <input
            type="text"
            id="schedule"
            name="schedule"
            value={formData.schedule}
            onChange={handleChange}
            required
            placeholder="*/5 * * * *"
          />
          <small>
            Examples: "*/5 * * * *" (every 5 minutes), "0 0 * * *" (daily at midnight), "0 */6 * * *" (every 6 hours)
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="image">Container Image *</label>
          <input
            type="text"
            id="image"
            name="image"
            value={formData.image}
            onChange={handleChange}
            required
            placeholder="busybox:latest"
          />
        </div>

        <div className="form-group">
          <label htmlFor="command">Command (optional)</label>
          <input
            type="text"
            id="command"
            name="command"
            value={formData.command}
            onChange={handleChange}
            placeholder="/bin/sh -c"
          />
          <small>Space-separated command arguments</small>
        </div>

        <div className="form-group">
          <label htmlFor="args">Arguments (optional)</label>
          <input
            type="text"
            id="args"
            name="args"
            value={formData.args}
            onChange={handleChange}
            placeholder="echo hello world"
          />
          <small>Space-separated arguments</small>
        </div>

        <div className="form-group">
          <label htmlFor="concurrency_policy">Concurrency Policy</label>
          <select
            id="concurrency_policy"
            name="concurrency_policy"
            value={formData.concurrency_policy}
            onChange={handleChange}
          >
            <option value="Allow">Allow</option>
            <option value="Forbid">Forbid</option>
            <option value="Replace">Replace</option>
          </select>
          <small>How to handle concurrent job executions</small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="successful_jobs_history_limit">Successful Jobs History</label>
            <input
              type="number"
              id="successful_jobs_history_limit"
              name="successful_jobs_history_limit"
              value={formData.successful_jobs_history_limit}
              onChange={handleChange}
              min="0"
              max="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="failed_jobs_history_limit">Failed Jobs History</label>
            <input
              type="number"
              id="failed_jobs_history_limit"
              name="failed_jobs_history_limit"
              value={formData.failed_jobs_history_limit}
              onChange={handleChange}
              min="0"
              max="10"
            />
          </div>
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              name="suspend"
              checked={formData.suspend}
              onChange={handleChange}
            />
            Suspend (prevents the CronJob from running)
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update CronJob' : 'Create CronJob')}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default CronJobForm;
