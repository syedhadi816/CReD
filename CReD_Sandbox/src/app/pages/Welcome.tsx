import { Button } from '../components/ui/button';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';

type Role = 'student' | 'educator';

interface WelcomeProps {
  onSelectRole: (role: Role) => void;
}

export default function Welcome({ onSelectRole }: WelcomeProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
      }}
    >
      <header style={{ width: '100%', padding: '2rem' }}>
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center' }}>
          <img src={logoImage} alt="CReD Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '1rem' }}>
        <h2
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            fontFamily: "'Playfair Display', serif",
            letterSpacing: '0.02em',
          }}
        >
          Welcome to CReD Sandbox!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.9)', marginTop: '1rem', fontSize: '1.1rem' }}>
          Choose how you’re using CReD today.
        </p>
      </div>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            width: '100%',
            maxWidth: '24rem',
          }}
        >
          <Button
            className="w-full bg-white text-purple-800 hover:bg-gray-100 h-14 text-lg font-medium"
            onClick={() => onSelectRole('student')}
          >
            For Students
          </Button>
          <Button
            className="w-full bg-purple-900/80 text-white hover:bg-purple-900 h-14 text-lg font-medium border border-white/20"
            onClick={() => onSelectRole('educator')}
          >
            For Educators
          </Button>
        </div>
      </main>
    </div>
  );
}
