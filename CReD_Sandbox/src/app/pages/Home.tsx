import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useState } from 'react';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import { login } from '../api';

interface HomeProps {
  role: "educator" | "student";
  onNavigate: () => void;
  onBack: () => void;
}

export default function Home({ role, onNavigate, onBack }: HomeProps) {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidAccessCode = (code: string) => {
    const codeRegex = /^\d{6}$/;
    return codeRegex.test(code);
  };

  const isFormValid = isValidEmail(email) && isValidAccessCode(accessCode);

  const handleGetStarted = async () => {
    if (!isFormValid) return;
    setError('');
    setLoading(true);
    try {
      const data = await login(email, accessCode, role);
      localStorage.setItem('cred_token', data.token);
      onNavigate();
    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
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
      <header style={{ width: '100%', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          ← Back
        </button>
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center' }}>
          <img src={logoImage} alt="cReD Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      {/* Welcome Message */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '1rem' }}>
        <h2 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: 'white',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          fontFamily: "'Playfair Display', serif",
          letterSpacing: '0.02em'
        }}>
          Welcome to CReD Sandbox!
        </h2>
      </div>

      {/* Main Content - Login Section */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '1rem' 
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '28rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            Log In
          </h1>

          <div style={{ marginBottom: '1rem' }}>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder=""
              style={{ width: '100%', marginTop: '0.5rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <Label htmlFor="access-code">Access Code</Label>
            <Input
              id="access-code"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              style={{ width: '100%', marginTop: '0.5rem' }}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
          </div>

          {error && (
            <div style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '1.5rem' 
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer' 
            }}>
              <input type="checkbox" style={{ width: '1rem', height: '1rem' }} />
              <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>Remember me</span>
            </label>
          </div>

          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={!isFormValid || loading}
            onClick={handleGetStarted}
          >
            {loading ? 'Signing in...' : 'Get Started'}
          </Button>
        </div>
      </main>
    </div>
  );
}