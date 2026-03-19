import { useState, useEffect } from 'react';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import { getTopics, createSession } from '../api';

interface ChooseTopicProps {
  onNavigate: (topic: string, sessionId?: string) => void;
}

export default function ChooseTopic({ onNavigate }: ChooseTopicProps) {
  const [topics, setTopics] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTopics()
      .then(setTopics)
      .catch((e) => setError(e?.message ?? 'Failed to load topics'))
      .finally(() => setLoading(false));
  }, []);

  const handleTopicClick = async (topicId: string, topicName: string) => {
    setError('');
    try {
      const { sessionId } = await createSession(topicId);
      onNavigate(topicId, sessionId);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)'
    }}>
      {/* Header with Logo */}
      <header style={{ width: '100%', padding: '2rem' }}>
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center' }}>
          <img src={logoImage} alt="cReD Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '2rem' 
      }}>
        <h1 style={{ fontSize: '1.875rem', color: 'white', marginBottom: '2rem' }}>
          Choose a Topic
        </h1>
        
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '2rem',
          maxWidth: '56rem',
          width: '100%'
        }}>
          {error && (
            <div style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading topics...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {topics.map((topic) => (
                <div 
                  key={topic.id}
                  style={{
                    padding: '1.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => handleTopicClick(topic.id, topic.name)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                    {topic.name}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {topic.description ?? 'Assessment'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
