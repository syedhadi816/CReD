import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Menu, X, Check, ArrowLeft, Send, Loader2 } from 'lucide-react';
import logoImage from '../../assets/da6b1869f10e5f3de33eb0e53a06a400a310b074.png';
import { MarkdownMath } from '../components/MarkdownMath';
import {
  getQuestions,
  getQuestion,
  startAttempt,
  getAttemptProgress,
  checkStep,
  sendChat,
  activateHelp,
} from '../api';

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

interface QuestionItem {
  id: string;
  prompt: string;
}

interface QuestionDetail {
  id: string;
  prompt: string;
  topic: string;
  type: 'MCQ' | 'FREE_FORM';
  options: string[] | null;
  correctOptionIndex: number | null;
  steps?: { index: number; id: string; label: string; prompt: string }[];
}

interface AssessmentProps {
  topic: string;
  sessionId: string;
  onBack: () => void;
  onComplete: (data: any) => void;
}

export default function Assessment({ topic, sessionId, onBack, onComplete }: AssessmentProps) {
  const [questionList, setQuestionList] = useState<QuestionItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDetail | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [finalStatus, setFinalStatus] = useState<'correct' | 'incorrect' | null>(null);
  const [mcqSelectedIndex, setMcqSelectedIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [helpActivated, setHelpActivated] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isMCQ = currentQuestion?.type === 'MCQ' && currentQuestion.options && currentQuestion.options.length > 0;

  /** Keep newest messages visible (Markdown/KaTeX may resize after paint, so scroll again shortly after). */
  useEffect(() => {
    if (!helpActivated || messages.length === 0) return;
    const el = chatScrollRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    const t = window.setTimeout(scrollToBottom, 80);
    return () => clearTimeout(t);
  }, [messages, chatLoading, helpActivated]);

  useEffect(() => {
    getQuestions(topic)
      .then(setQuestionList)
      .catch((e) => setError(e?.message ?? 'Failed to load questions'))
      .finally(() => setLoading(false));
  }, [topic]);

  useEffect(() => {
    if (questionList.length > 0 && !currentQuestion && sessionId) {
      loadQuestion(questionList[0].id, 0);
    }
  }, [questionList, sessionId]);

  const loadQuestion = async (questionId: string, index: number) => {
    setError('');
    setCurrentQuestionIndex(index);
    setFinalAnswer('');
    setFinalStatus(null);
    setMcqSelectedIndex(null);
    setMessages([]);
    try {
      const detail = await getQuestion(questionId);
      setCurrentQuestion(detail);
      const { attemptId: aid } = await startAttempt(sessionId, questionId);
      setAttemptId(aid);
      const progress = await getAttemptProgress(aid);
      setCompletedStepIndices(progress.completedStepIndices);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load question');
    }
  };

  const refreshProgress = async () => {
    if (!attemptId) return;
    try {
      const progress = await getAttemptProgress(attemptId);
      setCompletedStepIndices(progress.completedStepIndices);
    } catch (_) {}
  };

  const finalStepIndex =
    currentQuestion?.steps && currentQuestion.steps.length > 0
      ? currentQuestion.steps[currentQuestion.steps.length - 1].index
      : 0;

  const handleCheckFinal = async () => {
    const answerText =
      isMCQ && mcqSelectedIndex !== null && currentQuestion?.options
        ? currentQuestion.options[mcqSelectedIndex]
        : finalAnswer.trim();
    const answer = answerText;
    if (!answer || !attemptId || !currentQuestion) return;
    setCheckLoading(true);
    setFinalStatus(null);
    try {
      const result = await checkStep(attemptId, finalStepIndex, answer);
      setFinalStatus(result.correct ? 'correct' : 'incorrect');
      setCompletedStepIndices(result.completedStepIndices);
      if (result.correct) {
        setFinalAnswer('');
        setMcqSelectedIndex(null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Check failed');
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !currentQuestion || chatLoading || !helpActivated) return;
    setMessages((prev) => [...prev, { text, sender: 'user' }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { content } = await sendChat(sessionId, currentQuestion.id, text);
      setMessages((prev) => [...prev, { text: content, sender: 'bot' }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { text: e?.message ?? 'Could not get a response. Is Ollama running?', sender: 'bot' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (!currentQuestion || questionList.length === 0) return;
    if (currentQuestionIndex >= questionList.length - 1) {
      onComplete({
        topic,
        totalAnswered: questionList.length,
        totalQuestions: questionList.length,
      });
    } else {
      loadQuestion(questionList[currentQuestionIndex + 1].id, currentQuestionIndex + 1);
    }
  };

  const handleActivateHelp = async () => {
    if (!currentQuestion || helpActivated) return;
    setError('');
    try {
      await activateHelp(sessionId, currentQuestion.id);
      setHelpActivated(true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to activate help');
    }
  };

  const handleQuestionSelect = (index: number) => {
    loadQuestion(questionList[index].id, index);
    setIsSideMenuOpen(false);
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
        }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (questionList.length === 0 && !loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
          padding: '2rem',
        }}
      >
        <p style={{ color: 'white', marginBottom: '1rem' }}>No questions for this topic yet.</p>
        <Button onClick={onBack} className="bg-white text-purple-700 hover:bg-gray-100">
          Back to Topics
        </Button>
      </div>
    );
  }

  if (!currentQuestion && questionList.length > 0) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
        }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4338ca 100%)',
      }}
    >
      <header style={{ width: '100%', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center' }}>
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center' }}>
          <img src={logoImage} alt="CReD Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '0.5rem', overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            filter: isSideMenuOpen ? 'blur(2px)' : 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <Button onClick={onBack} variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Topics
            </Button>
            <Button onClick={() => setIsSideMenuOpen(true)} variant="ghost" className="p-2">
              <Menu className="w-6 h-6" />
            </Button>
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                width: '40%',
                padding: '1.5rem',
                borderRight: '1px solid #f3f4f6',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Question</h2>
              <div style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>
                <MarkdownMath>{currentQuestion!.prompt}</MarkdownMath>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Your Answer</h3>
                {isMCQ ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {currentQuestion!.options!.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setMcqSelectedIndex(idx)}
                          style={{
                            textAlign: 'left',
                            padding: '0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border:
                              mcqSelectedIndex === idx ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            backgroundColor: mcqSelectedIndex === idx ? '#faf5ff' : 'white',
                            cursor: 'pointer',
                          }}
                        >
                          <MarkdownMath variant="compact">{opt}</MarkdownMath>
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Button
                        onClick={handleCheckFinal}
                        disabled={mcqSelectedIndex === null || checkLoading}
                        className={
                          finalStatus === 'correct'
                            ? 'bg-green-600'
                            : finalStatus === 'incorrect'
                              ? 'bg-red-600'
                              : 'bg-purple-600'
                        }
                      >
                        {checkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Input
                      value={finalAnswer}
                      onChange={(e) => setFinalAnswer(e.target.value)}
                      placeholder="Enter your final answer..."
                      className="flex-1"
                    />
                    <Button
                      onClick={handleCheckFinal}
                      disabled={!finalAnswer.trim() || checkLoading}
                      className={
                        finalStatus === 'correct'
                          ? 'bg-green-600'
                          : finalStatus === 'incorrect'
                            ? 'bg-red-600'
                            : 'bg-purple-600'
                      }
                    >
                      {checkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                    </Button>
                  </div>
                )}
                {finalStatus === 'incorrect' && (
                  <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                    That final answer is not correct. Revisit the steps and ask the tutor for hints.
                  </p>
                )}
                {finalStatus === 'correct' && (
                  <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem' }}>
                    Final answer is correct. You can move to the next question.
                  </p>
                )}
              </div>

              {finalStatus === 'correct' && (
                <div style={{ marginTop: '1.5rem' }}>
                  <Button
                    onClick={handleNextQuestion}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {currentQuestionIndex >= questionList.length - 1
                      ? 'Finish'
                      : 'Next Question'}
                  </Button>
                </div>
              )}
            </div>

            <div
              style={{
                width: '60%',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Tutor chat</h3>
              {!helpActivated && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Button
                    onClick={handleActivateHelp}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Need Help?
                  </Button>
                </div>
              )}
              <div
                ref={chatScrollRef}
                style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: 0 }}
              >
                {helpActivated && messages.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '80%',
                            padding: '0.75rem 1rem',
                            borderRadius: '0.5rem',
                            backgroundColor: msg.sender === 'user' ? '#7c3aed' : '#f3f4f6',
                            color: msg.sender === 'user' ? 'white' : '#111827',
                          }}
                        >
                          {msg.sender === 'bot' ? (
                            <MarkdownMath>{msg.text}</MarkdownMath>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask for a hint..."
                  className="flex-1"
                  disabled={!helpActivated}
                />
                <Button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim() || !helpActivated}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isSideMenuOpen && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backdropFilter: 'blur(4px)',
                zIndex: 40,
              }}
              onClick={() => setIsSideMenuOpen(false)}
            />
            <div
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                height: '100%',
                width: '320px',
                backgroundColor: 'white',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.5rem',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Questions</h3>
                <Button onClick={() => setIsSideMenuOpen(false)} variant="ghost" className="p-2">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {questionList.map((q, index) => (
                    <div
                      key={q.id}
                      onClick={() => handleQuestionSelect(index)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid',
                        borderColor: currentQuestionIndex === index ? '#7c3aed' : '#e5e7eb',
                        backgroundColor: currentQuestionIndex === index ? '#faf5ff' : 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                        Question {index + 1}
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: '#4b5563',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          lineClamp: 2,
                        }}
                      >
                        <MarkdownMath variant="compact">{q.prompt}</MarkdownMath>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
