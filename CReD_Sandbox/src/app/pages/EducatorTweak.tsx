import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import { refineEducatorQuestion } from '../api';
import { MarkdownMath } from '../components/MarkdownMath';
import { ArrowLeft, Loader2, Minus, Plus } from 'lucide-react';

interface EducatorTweakProps {
  initialPrompt: string;
  onBackToList: (finalPrompt: string) => void;
}

export default function EducatorTweak({ initialPrompt, onBackToList }: EducatorTweakProps) {
  const [versions, setVersions] = useState<string[]>([initialPrompt]);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const current = versions[cursor] ?? '';

  /** After async refine, always use latest cursor so history is truncated correctly. */
  const pushNewVersion = (next: string) => {
    const c = cursorRef.current;
    setVersions((v) => [...v.slice(0, c + 1), next]);
    const nextCursor = c + 1;
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
  };

  const normalizeForCompare = (s: string) => s.replace(/\s+/g, ' ').trim();

  const runRefine = async (mode: 'instruction' | 'difficulty_up' | 'difficulty_down') => {
    if (mode === 'instruction' && !instruction.trim()) {
      setError('Enter how you want this question changed.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { prompt } = await refineEducatorQuestion({
        baseQuestion: current,
        mode,
        educatorInstruction: mode === 'instruction' ? instruction.trim() : undefined,
      });
      if (mode !== 'instruction') {
        if (normalizeForCompare(prompt) === normalizeForCompare(current)) {
          setError(
            'The model returned the same text. Try − or + again, or use Apply instruction to spell out the change you want.',
          );
          return;
        }
      }
      pushNewVersion(prompt);
      if (mode === 'instruction') setInstruction('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refine failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
      }}
    >
      <header
        style={{
          width: '100%',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBackToList(current)}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to list
        </Button>
        <div style={{ height: '3rem' }}>
          <img src={logoImage} alt="CReD" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center', paddingBottom: '2rem' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '52rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Tweak question</h1>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
            Only the text you enter below is sent as an edit instruction. Difficulty + / − use small automatic
            adjustments.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
              Version {cursor + 1} of {versions.length}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={cursor <= 0 || loading}
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
              >
                ← Previous version
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cursor >= versions.length - 1 || loading}
                onClick={() => setCursor((c) => Math.min(versions.length - 1, c + 1))}
              >
                Next version →
              </Button>
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              minHeight: '8rem',
              background: '#fafafa',
            }}
          >
            <MarkdownMath>{current}</MarkdownMath>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
              <Label htmlFor="tweak-instr">Your edit instruction</Label>
              <textarea
                id="tweak-instr"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={4}
                placeholder="Describe how to change this question…"
                disabled={loading}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <Button
                className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                disabled={loading}
                onClick={() => void runRefine('instruction')}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply instruction'}
              </Button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                flex: '0 0 auto',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>
                Difficulty
              </span>
              <span style={{ fontSize: '0.65rem', color: '#6b7280', textAlign: 'center', maxWidth: '9rem' }}>
                − simplifies the task; + adds challenge
              </span>
              <Button
                type="button"
                aria-label="Increase difficulty slightly"
                className="h-16 w-16 rounded-xl text-3xl font-bold bg-purple-600 hover:bg-purple-700 text-white p-0"
                disabled={loading}
                onClick={() => void runRefine('difficulty_up')}
              >
                <Plus className="w-10 h-10" strokeWidth={3} />
              </Button>
              <Button
                type="button"
                aria-label="Decrease difficulty slightly"
                className="h-16 w-16 rounded-xl text-3xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 p-0"
                disabled={loading}
                onClick={() => void runRefine('difficulty_down')}
              >
                <Minus className="w-10 h-10" strokeWidth={3} />
              </Button>
            </div>
          </div>

          {error ? (
            <div style={{ marginTop: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>
          ) : null}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => onBackToList(current)} disabled={loading}>
              Done — return to list with this version
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
