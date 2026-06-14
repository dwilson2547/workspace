import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CronJobList from './components/CronJobList';
import CronJobForm from './components/CronJobForm';
import CronJobDetail from './components/CronJobDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>⏰ Kubernetes CronJob Manager</h1>
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/create">Create CronJob</Link>
          </nav>
        </header>
        
        <main className="App-main">
          <Routes>
            <Route path="/" element={<CronJobList />} />
            <Route path="/create" element={<CronJobForm />} />
            <Route path="/edit/:namespace/:name" element={<CronJobForm />} />
            <Route path="/cronjob/:namespace/:name" element={<CronJobDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
