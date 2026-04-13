import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import { generateEducatorQuestions, type GeneratedQuestion } from '../api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export interface EducatorDraft {
  prompt: string;
  numQuestions: string;
  gradeLevel: string;
}

interface EducatorPromptProps {
  initial: EducatorDraft;
  /** Question texts already in review or kept; generation will steer toward new scenarios. */
  existingQuestionPrompts?: string[];
  onBack: () => void;
  onGenerated: (questions: GeneratedQuestion[], draft: EducatorDraft, warning?: string) => void;
}

export default function EducatorPrompt({
  initial,
  existingQuestionPrompts = [],
  onBack,
  onGenerated,
}: EducatorPromptProps) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [numQuestions, setNumQuestions] = useState(initial.numQuestions);
  const [gradeLevel, setGradeLevel] = useState(initial.gradeLevel);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const n = parseInt(numQuestions, 10);
    if (!prompt.trim()) {
      setError('Enter a prompt or paste your lesson content.');
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      setError('Number of questions must be between 1 and 50.');
      return;
    }
    if (!gradeLevel.trim()) {
      setError('Enter a grade level (e.g. 8th grade, Algebra II).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { questions, warning } = await generateEducatorQuestions({
        prompt: prompt.trim(),
        numQuestions: n,
        gradeLevel: gradeLevel.trim(),
        existingPrompts: existingQuestionPrompts.length ? existingQuestionPrompts : undefined,
      });
      onGenerated(
        questions,
        {
          prompt: prompt.trim(),
          numQuestions: String(n),
          gradeLevel: gradeLevel.trim(),
        },
        warning,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
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
      <header style={{ width: '100%', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div style={{ height: '3rem' }}>
          <img src={logoImage} alt="CReD" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '40rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <h1 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '1rem' }}>Create questions</h1>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
            Describe your lesson, paste a plan, or enter any context. We’ll generate questions using your grade level
            and count.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <Label htmlFor="ed-prompt">Prompt / lesson context</Label>
            <textarea
              id="ed-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="e.g. Linear equations in one variable; focus on word problems..."
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label htmlFor="ed-num">Number of Questions</Label>
              <Input
                id="ed-num"
                type="number"
                min={1}
                max={50}
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
                style={{ marginTop: '0.5rem' }}
              />
            </div>
            <div>
              <Label htmlFor="ed-grade">Grade Level</Label>
              <Input
                id="ed-grade"
                type="text"
                placeholder="e.g. 7th grade"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                style={{ marginTop: '0.5rem' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>
          )}

          <Button
            className="w-full bg-purple-600 hover:bg-purple-700 inline-flex items-center justify-center gap-2"
            disabled={loading}
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate questions'
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
