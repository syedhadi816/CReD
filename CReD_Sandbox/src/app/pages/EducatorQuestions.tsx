import { Button } from '../components/ui/button';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import type { GeneratedQuestion } from '../api';
import { MarkdownMath } from '../components/MarkdownMath';
import { BookOpen, CheckCircle2, Download, Loader2, PlayCircle } from 'lucide-react';

interface EducatorQuestionsProps {
  reviewQuestions: GeneratedQuestion[];
  keptQuestions: GeneratedQuestion[];
  warning?: string | null;
  onKeep: (id: string) => void;
  onDiscard: (id: string) => void;
  onTweak: (id: string) => void;
  onEditPrompt: () => void;
  onGenerateNew: () => void;
  generateNewDisabled?: boolean;
  generateNewLoading?: boolean;
  /** Review queue empty but kept items remain — show export / administer. */
  showKeptSessionActions?: boolean;
  onDownloadPdf?: () => void;
  onAdministerQuestions?: () => void;
  pdfLoading?: boolean;
  administerLoading?: boolean;
  /** Administered MCQ count (Student Testing Sandbox). */
  educatorBankCount?: number;
  onOpenStudentSandbox?: () => void;
  studentSandboxLoading?: boolean;
}

function QuestionRow({
  q,
  indexLabel,
  onKeep,
  onDiscard,
  onTweak,
  showKeep,
  showKeptCheck,
}: {
  q: GeneratedQuestion;
  indexLabel: string;
  onKeep?: () => void;
  onDiscard: () => void;
  onTweak: () => void;
  showKeep: boolean;
  showKeptCheck: boolean;
}) {
  return (
    <li
      style={{
        fontSize: '0.95rem',
        listStyle: 'none',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1rem',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.35rem',
        }}
      >
        <div style={{ fontWeight: 600, color: '#374151' }}>{indexLabel}</div>
        {showKeptCheck ? (
          <CheckCircle2 className="w-7 h-7 shrink-0 text-green-600" strokeWidth={2} aria-label="Kept" />
        ) : null}
      </div>
      <div style={{ color: '#111827', marginBottom: '0.75rem' }}>
        <MarkdownMath>{q.prompt}</MarkdownMath>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {showKeep ? (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onKeep}>
            Keep
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" variant="secondary" onClick={onTweak}>
          Tweak
        </Button>
      </div>
    </li>
  );
}

export default function EducatorQuestions({
  reviewQuestions,
  keptQuestions,
  warning,
  onKeep,
  onDiscard,
  onTweak,
  onEditPrompt,
  onGenerateNew,
  generateNewDisabled,
  generateNewLoading,
  showKeptSessionActions,
  onDownloadPdf,
  onAdministerQuestions,
  pdfLoading,
  administerLoading,
  educatorBankCount = 0,
  onOpenStudentSandbox,
  studentSandboxLoading,
}: EducatorQuestionsProps) {
  const total = reviewQuestions.length + keptQuestions.length;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
      }}
    >
      <header style={{ width: '100%', padding: '1rem 2rem' }}>
        <div style={{ height: '3rem' }}>
          <img src={logoImage} alt="CReD" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center', paddingBottom: '7.5rem' }}>
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
          <h1 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '1rem' }}>Questions</h1>
          {warning ? (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#92400e',
              }}
            >
              {warning}
            </div>
          ) : null}
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.25rem' }}>
            {total === 0
              ? 'No questions in this view.'
              : `${total} question${total === 1 ? '' : 's'} — Kept items stay for this browser session until you leave or refresh.`}{' '}
            <strong>Generate New</strong> adds one more question using the same prompt and grade level you last used; the model is told to use a different scenario from everything in Kept and Under review.
          </p>

          {showKeptSessionActions && keptQuestions.length > 0 ? (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #86efac',
                background: '#f0fdf4',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: '#166534', marginBottom: '0.75rem', fontWeight: 600 }}>
                Review queue is clear — you can use your kept set
              </p>
              <p style={{ fontSize: '0.8rem', color: '#15803d', marginBottom: '0.75rem' }}>
                <strong>Download questions</strong> builds a PDF of the kept stems with worked solutions.{' '}
                <strong>Administer questions</strong> converts each into multiple choice with tutor guidance and adds them
                to your <strong>Student Testing Sandbox</strong> (inside the educator portal only — not the public student
                topic list). You can preview them there like a student, with the same help chat.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={pdfLoading || administerLoading}
                  onClick={() => onDownloadPdf?.()}
                >
                  {pdfLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                      Building PDF…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2 inline" />
                      Download questions
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-green-700 text-green-800 hover:bg-green-50"
                  disabled={pdfLoading || administerLoading}
                  onClick={() => onAdministerQuestions?.()}
                >
                  {administerLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 mr-2 inline" />
                      Administer questions
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {keptQuestions.length > 0 ? (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#065f46' }}>
                Kept this session ({keptQuestions.length})
              </h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', padding: 0 }}>
                {keptQuestions.map((q, i) => (
                  <QuestionRow
                    key={q.id}
                    q={q}
                    indexLabel={`Kept ${i + 1}`}
                    showKeep={false}
                    showKeptCheck
                    onDiscard={() => onDiscard(q.id)}
                    onTweak={() => onTweak(q.id)}
                  />
                ))}
              </ul>
            </>
          ) : null}

          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1f2937' }}>
            Under review ({reviewQuestions.length})
          </h2>
          {reviewQuestions.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Nothing left here — generate more from Edit prompt, or move items to Kept.</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: 0 }}>
              {reviewQuestions.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  indexLabel={`Review ${i + 1}`}
                  showKeep
                  showKeptCheck={false}
                  onKeep={() => onKeep(q.id)}
                  onDiscard={() => onDiscard(q.id)}
                  onTweak={() => onTweak(q.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1rem',
          background: 'linear-gradient(to top, rgba(67,56,202,0.95), transparent)',
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <Button
          className="bg-white text-purple-800 hover:bg-gray-100 min-w-[12rem] border border-purple-200"
          onClick={onGenerateNew}
          disabled={generateNewDisabled || generateNewLoading}
        >
          {generateNewLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
              Generating…
            </>
          ) : (
            'Generate New'
          )}
        </Button>
        {educatorBankCount > 0 ? (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[12rem] border border-emerald-700"
            onClick={() => onOpenStudentSandbox?.()}
            disabled={studentSandboxLoading}
          >
            {studentSandboxLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                Opening…
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2 inline" />
                Student Testing Sandbox
              </>
            )}
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="bg-white border-purple-200 text-purple-800 hover:bg-purple-50 min-w-[12rem]"
          onClick={onEditPrompt}
        >
          Edit prompt
        </Button>
      </div>
    </div>
  );
}
