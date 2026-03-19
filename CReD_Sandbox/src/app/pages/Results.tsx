import { Button } from '../components/ui/button';
import { CheckCircle } from 'lucide-react';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';

interface ResultsProps {
  data: {
    topic: string;
    totalAnswered: number;
    totalQuestions: number;
  };
  onNavigate: () => void;
}

export default function Results({ data, onNavigate }: ResultsProps) {
  if (!data) {
    return null;
  }

  const { topic, totalAnswered, totalQuestions } = data;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)'
    }}>
      {/* Header */}
      <header style={{ width: '100%', padding: '0.5rem 1rem' }}>
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center' }}>
          <img src={logoImage} alt="cReD Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '2rem',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '3rem',
          maxWidth: '32rem',
          width: '100%'
        }}>
          {/* All Done with Check Icon */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              backgroundColor: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <CheckCircle className="w-14 h-14 text-green-600" />
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>All Done!</h1>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#7c3aed',
              textTransform: 'capitalize'
            }}>
              {topic}
            </h2>
          </div>

          {/* Total Questions Answered */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed' }}>
              {totalQuestions} Questions Answered
            </p>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button
              onClick={onNavigate}
              className="bg-purple-600 hover:bg-purple-700 px-8"
            >
              Return to Topics
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}