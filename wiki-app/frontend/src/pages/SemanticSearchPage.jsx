import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Info } from 'lucide-react';
import SemanticSearch from '../components/SemanticSearch';
import { useAuth } from '../context/AuthContext';

export default function SemanticSearchPage() {
  const { user } = useAuth();
  const [selectedWiki, setSelectedWiki] = useState(null);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Sign in Required</h2>
          <p className="text-secondary mb-4">
            Please sign in to use AI-powered semantic search.
          </p>
          <Link to="/login" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="semantic-search-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="search-page-header">
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            <span className="ml-2">Back to Home</span>
          </Link>
          
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Sparkles size={32} className="text-primary" />
              <h1 className="text-3xl font-bold">AI Search</h1>
            </div>
            <p className="text-secondary">
              Search your wikis using AI-powered semantic understanding
            </p>
          </div>

          <div style={{ width: '140px' }} /> {/* Spacer for centering */}
        </div>

        {/* Info Banner */}
        <div className="alert alert-info mb-6">
          <Info size={20} />
          <div>
            <h4 className="font-semibold">How it works</h4>
            <p className="text-sm">
              AI Search understands the meaning of your query, not just keywords. 
              Try asking questions naturally like "how to install dependencies" or "authentication setup".
            </p>
          </div>
        </div>

        {/* Main Search Component */}
        <div className="card p-6">
          <SemanticSearch 
            wikiId={selectedWiki}
            placeholder="Ask anything... (e.g., 'how to configure authentication')"
            defaultMode="semantic"
            showModeToggle={true}
            className="semantic-search-main"
          />
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} className="text-primary" />
              <h3 className="font-semibold">AI Search</h3>
            </div>
            <p className="text-sm text-secondary">
              Pure semantic search that understands context and meaning beyond keywords.
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚡</span>
              <h3 className="font-semibold">Hybrid Search</h3>
            </div>
            <p className="text-sm text-secondary">
              Combines AI understanding with traditional keyword matching for best results.
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔍</span>
              <h3 className="font-semibold">Keyword Search</h3>
            </div>
            <p className="text-sm text-secondary">
              Traditional full-text search when you know exactly what you're looking for.
            </p>
          </div>
        </div>

        {/* Tips Section */}
        <div className="card p-6 mt-8">
          <h3 className="text-xl font-bold mb-4">Search Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">✅ Good queries:</h4>
              <ul className="text-sm text-secondary space-y-1 ml-4">
                <li>• "How do I set up authentication?"</li>
                <li>• "Database connection configuration"</li>
                <li>• "Error handling best practices"</li>
                <li>• "Install dependencies for React"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">💡 Pro tips:</h4>
              <ul className="text-sm text-secondary space-y-1 ml-4">
                <li>• Use natural language questions</li>
                <li>• Try different search modes for best results</li>
                <li>• Adjust similarity threshold for more/fewer results</li>
                <li>• Use hybrid mode when unsure</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
