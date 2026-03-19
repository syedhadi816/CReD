import { useState } from 'react';
import Home from './pages/Home';
import ChooseTopic from './pages/ChooseTopic';
import Assessment from './pages/Assessment';
import Results from './pages/Results';

type Page = 'home' | 'choose-topic' | 'assessment' | 'results';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [resultsData, setResultsData] = useState<any>(null);

  if (typeof document !== 'undefined') {
    document.title = 'CReD Sandbox';
  }

  const navigate = (page: Page, data?: any) => {
    setCurrentPage(page);
    if (data) {
      if (page === 'assessment') {
        setSelectedTopic(data.topic);
        setSessionId(data.sessionId ?? '');
      } else if (page === 'results') {
        setResultsData(data);
      }
    }
  };

  if (currentPage === 'home') {
    return <Home onNavigate={() => navigate('choose-topic')} />;
  }

  if (currentPage === 'choose-topic') {
    return (
      <ChooseTopic
        onNavigate={(topic: string, sessionId?: string) =>
          navigate('assessment', { topic, sessionId })
        }
      />
    );
  }

  if (currentPage === 'assessment') {
    return (
      <Assessment 
        topic={selectedTopic}
        sessionId={sessionId}
        onBack={() => navigate('choose-topic')}
        onComplete={(data: any) => navigate('results', data)}
      />
    );
  }

  if (currentPage === 'results') {
    return <Results data={resultsData} onNavigate={() => navigate('choose-topic')} />;
  }

  return null;
}