import { useEffect, useState } from 'react';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ChooseTopic from './pages/ChooseTopic';
import Assessment from './pages/Assessment';
import Results from './pages/Results';
import EducatorPrompt, { type EducatorDraft } from './pages/EducatorPrompt';
import EducatorQuestions from './pages/EducatorQuestions';
import EducatorTweak from './pages/EducatorTweak';
import {
  generateEducatorQuestions,
  exportEducatorPdf,
  administerEducatorBank,
  getEducatorBankCount,
  createSession,
  endSession,
  EDUCATOR_SANDBOX_TOPIC,
  type GeneratedQuestion,
} from './api';

type Role = 'student' | 'educator';

type Page =
  | 'welcome'
  | 'login'
  | 'choose-topic'
  | 'assessment'
  | 'results'
  | 'educator-prompt'
  | 'educator-questions'
  | 'educator-tweak'
  | 'educator-sandbox';

const defaultEducatorDraft: EducatorDraft = {
  prompt: '',
  numQuestions: '5',
  gradeLevel: '',
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [role, setRole] = useState<Role | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [resultsData, setResultsData] = useState<any>(null);

  const [educatorDraft, setEducatorDraft] = useState<EducatorDraft>(defaultEducatorDraft);
  const [educatorReview, setEducatorReview] = useState<GeneratedQuestion[]>([]);
  const [educatorKept, setEducatorKept] = useState<GeneratedQuestion[]>([]);
  const [educatorWarning, setEducatorWarning] = useState<string | null>(null);
  const [educatorTweakId, setEducatorTweakId] = useState<string | null>(null);
  const [educatorGenerateNewLoading, setEducatorGenerateNewLoading] = useState(false);
  const [educatorPdfLoading, setEducatorPdfLoading] = useState(false);
  const [educatorAdministerLoading, setEducatorAdministerLoading] = useState(false);
  const [educatorBankCount, setEducatorBankCount] = useState(0);
  const [studentSandboxLoading, setStudentSandboxLoading] = useState(false);

  if (typeof document !== 'undefined') {
    document.title = 'CReD Sandbox';
  }

  const backToWelcome = () => {
    localStorage.removeItem('cred_token');
    setRole(null);
    setEducatorDraft(defaultEducatorDraft);
    setEducatorReview([]);
    setEducatorKept([]);
    setEducatorWarning(null);
    setEducatorTweakId(null);
    setCurrentPage('welcome');
  };

  const navigate = (page: Page, data?: any) => {
    setCurrentPage(page);
    if (data) {
      if (page === 'assessment' || page === 'educator-sandbox') {
        setSelectedTopic(data.topic);
        setSessionId(data.sessionId ?? '');
      } else if (page === 'results') {
        setResultsData(data);
      }
    }
  };

  const updateQuestionPrompt = (id: string, prompt: string) => {
    setEducatorReview((rq) => rq.map((q) => (q.id === id ? { ...q, prompt } : q)));
    setEducatorKept((kq) => kq.map((q) => (q.id === id ? { ...q, prompt } : q)));
  };

  const handleEducatorKeep = (id: string) => {
    const q = educatorReview.find((x) => x.id === id);
    if (!q) return;
    setEducatorReview((r) => r.filter((x) => x.id !== id));
    setEducatorKept((k) => [...k, q]);
  };

  const handleEducatorDiscard = (id: string) => {
    setEducatorReview((r) => r.filter((x) => x.id !== id));
    setEducatorKept((k) => k.filter((x) => x.id !== id));
  };

  const educatorExistingPrompts = [...educatorKept, ...educatorReview].map((q) => q.prompt);

  const handleEducatorDownloadPdf = async () => {
    const prompts = educatorKept.map((q) => q.prompt);
    if (prompts.length === 0) return;
    setEducatorPdfLoading(true);
    setEducatorWarning(null);
    try {
      const blob = await exportEducatorPdf(prompts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cred-questions.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setEducatorWarning(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setEducatorPdfLoading(false);
    }
  };

  const handleEducatorAdminister = async () => {
    const prompts = educatorKept.map((q) => q.prompt);
    if (prompts.length === 0) return;
    setEducatorAdministerLoading(true);
    setEducatorWarning(null);
    try {
      const result = await administerEducatorBank(prompts);
      try {
        const n = await getEducatorBankCount();
        setEducatorBankCount(n);
      } catch {
        setEducatorBankCount((c) => c + result.created);
      }
      if (result.created > 0) {
        const { sessionId: sid } = await createSession(EDUCATOR_SANDBOX_TOPIC);
        navigate('educator-sandbox', { topic: EDUCATOR_SANDBOX_TOPIC, sessionId: sid });
        setEducatorWarning(null);
      } else {
        setEducatorWarning(
          result.errors?.length
            ? `No questions were created. ${result.errors.length} item(s) failed to convert.`
            : 'No questions were created.',
        );
      }
    } catch (e: unknown) {
      setEducatorWarning(e instanceof Error ? e.message : 'Administer failed');
    } finally {
      setEducatorAdministerLoading(false);
    }
  };

  const handleOpenStudentSandbox = async () => {
    setStudentSandboxLoading(true);
    setEducatorWarning(null);
    try {
      const { sessionId: sid } = await createSession(EDUCATOR_SANDBOX_TOPIC);
      navigate('educator-sandbox', { topic: EDUCATOR_SANDBOX_TOPIC, sessionId: sid });
    } catch (e: unknown) {
      setEducatorWarning(e instanceof Error ? e.message : 'Could not open sandbox');
    } finally {
      setStudentSandboxLoading(false);
    }
  };

  const handleEducatorGenerateOneNew = async () => {
    const prompt = educatorDraft.prompt.trim();
    const gradeLevel = educatorDraft.gradeLevel.trim();
    if (!prompt || !gradeLevel) {
      setEducatorWarning('Use Edit prompt first to set your lesson context and grade level.');
      return;
    }
    setEducatorGenerateNewLoading(true);
    setEducatorWarning(null);
    try {
      const { questions, warning } = await generateEducatorQuestions({
        prompt,
        numQuestions: 1,
        gradeLevel,
        existingPrompts: educatorExistingPrompts.length ? educatorExistingPrompts : undefined,
      });
      const one = questions[0];
      if (one) {
        setEducatorReview((r) => [...r, one]);
      }
      if (warning) setEducatorWarning(warning);
    } catch (e: unknown) {
      setEducatorWarning(e instanceof Error ? e.message : 'Could not generate a question.');
    } finally {
      setEducatorGenerateNewLoading(false);
    }
  };

  const tweakTarget =
    educatorTweakId != null
      ? [...educatorReview, ...educatorKept].find((q) => q.id === educatorTweakId)
      : undefined;

  useEffect(() => {
    if (currentPage !== 'educator-tweak' || !educatorTweakId) return;
    const exists = [...educatorReview, ...educatorKept].some((q) => q.id === educatorTweakId);
    if (!exists) {
      setEducatorTweakId(null);
      setCurrentPage('educator-questions');
    }
  }, [currentPage, educatorTweakId, educatorReview, educatorKept]);

  useEffect(() => {
    if (currentPage !== 'educator-questions') return;
    getEducatorBankCount()
      .then(setEducatorBankCount)
      .catch(() => setEducatorBankCount(0));
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === 'login' && !role) {
      setCurrentPage('welcome');
    }
  }, [currentPage, role]);

  if (currentPage === 'welcome') {
    return (
      <Welcome
        onSelectRole={(r) => {
          setRole(r);
          setCurrentPage('login');
        }}
      />
    );
  }

  if (currentPage === 'login' && role) {
    return (
      <Home
        role={role}
        onBack={backToWelcome}
        onNavigate={() => {
          if (role === 'educator') {
            setEducatorDraft(defaultEducatorDraft);
            setEducatorReview([]);
            setEducatorKept([]);
            setEducatorWarning(null);
            setEducatorTweakId(null);
            navigate('educator-prompt');
          } else {
            navigate('choose-topic');
          }
        }}
      />
    );
  }

  if (currentPage === 'choose-topic') {
    return (
      <ChooseTopic
        onNavigate={(topic: string, sid?: string) => navigate('assessment', { topic, sessionId: sid })}
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

  if (currentPage === 'educator-prompt') {
    return (
      <EducatorPrompt
        initial={educatorDraft}
        existingQuestionPrompts={educatorExistingPrompts}
        onBack={backToWelcome}
        onGenerated={(questions, draft, warning) => {
          setEducatorDraft(draft);
          setEducatorReview(questions);
          setEducatorWarning(warning ?? null);
          navigate('educator-questions');
        }}
      />
    );
  }

  if (currentPage === 'educator-sandbox') {
    return (
      <Assessment
        topic={selectedTopic}
        sessionId={sessionId}
        educatorSandboxMode
        onBack={() => {
          void endSession(sessionId).then(() => navigate('educator-questions'));
        }}
        onComplete={() => {
          void endSession(sessionId).then(() => navigate('educator-questions'));
        }}
      />
    );
  }

  if (currentPage === 'educator-tweak' && tweakTarget) {
    return (
      <EducatorTweak
        key={educatorTweakId}
        initialPrompt={tweakTarget.prompt}
        onBackToList={(finalPrompt) => {
          updateQuestionPrompt(tweakTarget.id, finalPrompt);
          setEducatorTweakId(null);
          navigate('educator-questions');
        }}
      />
    );
  }

  if (currentPage === 'educator-questions') {
    return (
      <EducatorQuestions
        reviewQuestions={educatorReview}
        keptQuestions={educatorKept}
        warning={educatorWarning}
        onKeep={handleEducatorKeep}
        onDiscard={handleEducatorDiscard}
        onTweak={(id) => {
          setEducatorTweakId(id);
          navigate('educator-tweak');
        }}
        onEditPrompt={() => navigate('educator-prompt')}
        onGenerateNew={() => void handleEducatorGenerateOneNew()}
        generateNewDisabled={!educatorDraft.prompt.trim() || !educatorDraft.gradeLevel.trim()}
        generateNewLoading={educatorGenerateNewLoading}
        showKeptSessionActions={educatorReview.length === 0 && educatorKept.length > 0}
        onDownloadPdf={() => void handleEducatorDownloadPdf()}
        onAdministerQuestions={() => void handleEducatorAdminister()}
        pdfLoading={educatorPdfLoading}
        administerLoading={educatorAdministerLoading}
        educatorBankCount={educatorBankCount}
        onOpenStudentSandbox={() => void handleOpenStudentSandbox()}
        studentSandboxLoading={studentSandboxLoading}
      />
    );
  }

  return null;
}
