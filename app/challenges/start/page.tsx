'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getGoalId, getUserId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, CheckCircle2, XCircle, Lightbulb, ArrowRight, RotateCcw, Unlock } from 'lucide-react';
import Link from 'next/link';

interface Question {
  id: string;
  questionNumber: number;
  question: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  hint?: string | null;
}

interface Challenge {
  id: string;
  goalId: string;
  sectionId: string;
  sectionTitle: string;
  sectionTopics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  status: string;
  totalQuestions: number;
  questions: Question[];
}

interface ChallengeProgressData {
  id: string;
  challengeId: string;
  visitorId: string;
  currentQuestionIndex: number;
  answers: Record<number, { answer: string; isCorrect: boolean }>;
  correctAnswers: number;
  earnedPoints: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    color: 'bg-green-100 text-green-700 border-green-200',
    totalPoints: 50
  },
  medium: {
    label: 'Medium',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    totalPoints: 100
  },
  hard: {
    label: 'Hard',
    color: 'bg-red-100 text-red-700 border-red-200',
    totalPoints: 200
  }
};

function ChallengeContent() {
  const searchParams = useSearchParams();
  const challengeId = searchParams.get('challengeId');

  const [userId, setUserId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);

  // Challenge data
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<number, { answer: string; isCorrect: boolean }>>({});
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  // View state
  const [viewState, setViewState] = useState<'loading' | 'question' | 'summary' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // Completion state
  const [unlockedDifficulty, setUnlockedDifficulty] = useState<string | null>(null);
  const [hasSubmittedCompletion, setHasSubmittedCompletion] = useState(false);

  const currentQuestion = challenge?.questions[currentQuestionIndex] || null;
  const difficulty = challenge?.difficulty || 'easy';
  const config = DIFFICULTY_CONFIG[difficulty];
  const totalQuestions = challenge?.totalQuestions || 10;
  const pointsPerQuestion = Math.round(config.totalPoints / totalQuestions);

  useEffect(() => {
    setUserId(getUserId());
    setGoalId(getGoalId());
  }, []);

  // Fetch challenge and progress
  const fetchChallengeAndProgress = useCallback(async () => {
    if (!userId || !goalId || !challengeId) return;

    try {
      // Fetch challenge data
      const challengeResponse = await fetch(`/api/users/${userId}/goals/${goalId}/challenges/${challengeId}`);

      if (!challengeResponse.ok) {
        const data = await challengeResponse.json();
        throw new Error(data.errorMessage || 'Failed to load challenge');
      }

      const challengeData = await challengeResponse.json();
      setChallenge(challengeData);

      // Fetch existing progress
      const progressResponse = await fetch(`/api/users/${userId}/goals/${goalId}/challenges/${challengeId}/progress`);

      if (progressResponse.ok) {
        const progressData: ChallengeProgressData = await progressResponse.json();

        // Restore progress state
        if (progressData.status === 'completed') {
          // Challenge was already completed, show summary
          setAnsweredQuestions(progressData.answers);
          setCorrectAnswersCount(progressData.correctAnswers);
          setEarnedPoints(progressData.earnedPoints);
          setViewState('summary');
        } else if (Object.keys(progressData.answers).length > 0) {
          // Has progress, resume from where left off
          setAnsweredQuestions(progressData.answers);
          setCorrectAnswersCount(progressData.correctAnswers);
          setEarnedPoints(progressData.earnedPoints);

          // Find the first unanswered question
          const answeredIndices = Object.keys(progressData.answers).map(Number);
          let resumeIndex = 0;
          for (let i = 0; i < challengeData.totalQuestions; i++) {
            if (!answeredIndices.includes(i)) {
              resumeIndex = i;
              break;
            }
            resumeIndex = i + 1; // All answered, go to summary
          }

          if (resumeIndex >= challengeData.totalQuestions) {
            // All questions answered but not marked complete
            setViewState('summary');
          } else {
            setCurrentQuestionIndex(resumeIndex);
            setViewState('question');
          }
        } else {
          // No progress, start from beginning
          setViewState('question');
        }
      } else {
        // No progress found, start fresh
        setViewState('question');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenge');
      setViewState('error');
    }
  }, [userId, goalId, challengeId]);

  useEffect(() => {
    if (userId && goalId && challengeId) {
      fetchChallengeAndProgress();
    } else if (!challengeId) {
      setError('No challenge ID provided');
      setViewState('error');
    }
  }, [userId, goalId, challengeId, fetchChallengeAndProgress]);

  // Save answer to server (server validates correctness)
  const saveAnswer = useCallback(
    async (questionNumber: number, answer: string) => {
      if (!userId || !goalId || !challengeId) return;

      try {
        await fetch(`/api/users/${userId}/goals/${goalId}/challenges/${challengeId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'answer',
            questionNumber,
            answer
          })
        });
      } catch (err) {
        console.error('Failed to save answer:', err);
      }
    },
    [userId, goalId, challengeId]
  );

  const submitAnswer = async () => {
    if (!currentQuestion || !selectedAnswer) return;

    const correct = selectedAnswer === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    // Update local state
    setAnsweredQuestions((prev) => ({
      ...prev,
      [currentQuestionIndex]: { answer: selectedAnswer, isCorrect: correct }
    }));

    if (correct) {
      setEarnedPoints((prev) => prev + pointsPerQuestion);
      setCorrectAnswersCount((prev) => prev + 1);
    }

    // Save to server (server validates correctness)
    await saveAnswer(currentQuestionIndex, selectedAnswer);
  };

  const submitCompletion = useCallback(
    async (correct: number, total: number) => {
      if (!userId || !goalId || !challengeId || hasSubmittedCompletion) return;

      setHasSubmittedCompletion(true);

      try {
        const response = await fetch(`/api/users/${userId}/goals/${goalId}/challenges/${challengeId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correctAnswers: correct, totalQuestions: total })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.unlockedNextLevel && data.unlockedDifficulty) {
            setUnlockedDifficulty(data.unlockedDifficulty);
          }
        }
      } catch (err) {
        console.error('Failed to submit completion:', err);
      }
    },
    [userId, goalId, challengeId, hasSubmittedCompletion]
  );

  const nextQuestion = async () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
      setIsCorrect(false);
    } else {
      // Submit completion when finishing the challenge
      await submitCompletion(correctAnswersCount, totalQuestions);
      setViewState('summary');
    }
  };

  const handleTryAgain = async () => {
    if (!userId || !goalId || !challengeId) {
      window.location.reload();
      return;
    }

    try {
      // Reset progress on server
      await fetch(`/api/users/${userId}/goals/${goalId}/challenges/${challengeId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });

      // Reset local state
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
      setIsCorrect(false);
      setAnsweredQuestions({});
      setCorrectAnswersCount(0);
      setEarnedPoints(0);
      setUnlockedDifficulty(null);
      setHasSubmittedCompletion(false);
      setViewState('question');
    } catch (err) {
      console.error('Failed to reset progress:', err);
      window.location.reload();
    }
  };

  // Error state
  if (viewState === 'error' || error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-red-500 mb-4">{error}</p>
        <Button asChild variant="outline">
          <Link href="/challenges">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Challenges
          </Link>
        </Button>
      </div>
    );
  }

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-muted-foreground">Loading challenge...</p>
      </div>
    );
  }

  // Summary state
  if (viewState === 'summary') {
    const answeredCount = Object.keys(answeredQuestions).length;
    const accuracy = answeredCount > 0 ? Math.round((correctAnswersCount / answeredCount) * 100) : 0;

    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <Trophy className="h-16 w-16 mx-auto text-accent mb-4" />
            <CardTitle className="text-2xl">Challenge Complete!</CardTitle>
            <p className="text-muted-foreground">{challenge?.sectionTitle}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{answeredCount}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{correctAnswersCount}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-accent">{earnedPoints}</p>
                <p className="text-sm text-muted-foreground">Points</p>
              </div>
            </div>

            <div className="text-center py-4">
              <p className="text-5xl font-bold text-accent mb-1">{accuracy}%</p>
              <p className="text-muted-foreground">Accuracy</p>
            </div>

            {/* Unlocked next level notification */}
            {unlockedDifficulty && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 text-green-700 font-medium">
                  <Unlock className="h-5 w-5" />
                  <span>{unlockedDifficulty.charAt(0).toUpperCase() + unlockedDifficulty.slice(1)} level unlocked!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">You scored 50% or higher. The next difficulty is now available.</p>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" asChild>
                <Link href="/challenges">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  All Challenges
                </Link>
              </Button>
              <Button onClick={handleTryAgain}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Question view
  const optionLabels = ['A', 'B', 'C', 'D'] as const;
  const answeredCount = Object.keys(answeredQuestions).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/challenges" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Challenges
        </Link>
        <Badge variant="outline" className={config.color}>
          {config.label}
        </Badge>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{challenge?.sectionTitle}</h1>
        <p className="text-muted-foreground">
          Question {currentQuestionIndex + 1} of {totalQuestions} • {earnedPoints} points earned
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>{correctAnswersCount} correct</span>
          <span>
            {answeredCount} of {totalQuestions} answered
          </span>
        </div>
        <Progress value={(answeredCount / totalQuestions) * 100} className="h-2" />
      </div>

      {/* Question Card */}
      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          {/* Question */}
          <div className="min-h-[60px]">
            <p className="text-lg font-medium">{currentQuestion?.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {optionLabels.map((label) => {
              const option = currentQuestion?.options.find((o) => o.label === label);
              const isSelected = selectedAnswer === label;
              const isCorrectAnswer = currentQuestion && label === currentQuestion.correctAnswer;
              const showCorrectHighlight = showResult && isCorrectAnswer;
              const showIncorrectHighlight = showResult && isSelected && !isCorrect;
              const isInteractive = !showResult;

              return (
                <button
                  key={label}
                  onClick={() => isInteractive && setSelectedAnswer(label)}
                  disabled={!isInteractive}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
                    showCorrectHighlight
                      ? 'border-green-500 bg-green-50'
                      : showIncorrectHighlight
                        ? 'border-red-500 bg-red-50'
                        : isSelected
                          ? 'border-accent bg-accent/10'
                          : isInteractive
                            ? 'border-muted hover:border-accent/50'
                            : 'border-muted'
                  }`}
                >
                  <span
                    className={`font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors duration-300 ${
                      showCorrectHighlight
                        ? 'bg-green-500 text-white'
                        : showIncorrectHighlight
                          ? 'bg-red-500 text-white'
                          : isSelected
                            ? 'bg-accent text-white'
                            : 'bg-muted'
                    }`}
                  >
                    {label}
                  </span>
                  <span className="flex-1">{option?.text}</span>
                  {showCorrectHighlight && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
                  {showIncorrectHighlight && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Hint */}
          {!showResult && currentQuestion?.hint && (
            <div>
              {showHint ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <Lightbulb className="inline h-4 w-4 mr-2" />
                    {currentQuestion.hint}
                  </p>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Show Hint
                </Button>
              )}
            </div>
          )}

          {/* Result Explanation */}
          {showResult && currentQuestion && (
            <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Correct! +{pointsPerQuestion} points
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    Incorrect
                  </>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" asChild>
              <Link href="/challenges">End Challenge</Link>
            </Button>

            {!showResult ? (
              <Button onClick={submitAnswer} disabled={!selectedAnswer}>
                Submit Answer
              </Button>
            ) : isCorrect ? (
              <Button onClick={nextQuestion}>
                {currentQuestionIndex < totalQuestions - 1 ? (
                  <>
                    Next Question
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  'Finish Challenge'
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowResult(false);
                  setSelectedAnswer(null);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChallengeStartPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ChallengeContent />
    </Suspense>
  );
}
