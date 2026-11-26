import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Award,
  Send,
} from 'lucide-react';
import { QUIZ_QUESTIONS } from '../data/defaultData.js';

export default function QuizPage({ lastResult, onCompleteQuiz }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const total = QUIZ_QUESTIONS.length;
  const currentQuestion = QUIZ_QUESTIONS[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === total;

  const selectOption = (questionId, optionIndex) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    const score = QUIZ_QUESTIONS.reduce(
      (acc, q) => (answers[q.id] === q.correctIndex ? acc + 1 : acc),
      0
    );
    const percentage = Math.round((score / total) * 100);
    setSubmitted(true);
    onCompleteQuiz({
      score,
      total,
      percentage,
      completedAt: new Date().toISOString(),
    });
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
  };

  const computedScore = QUIZ_QUESTIONS.reduce(
    (acc, q) => (answers[q.id] === q.correctIndex ? acc + 1 : acc),
    0
  );
  const percentage = Math.round((computedScore / total) * 100);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Prompt Engineering & AI MCQ Quiz
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Answer all 5 questions to test your Prompt Engineering, RAG, and AI fundamentals.
          </p>
        </div>

        {lastResult && !submitted && (
          <div className="px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Last Score: {lastResult.score}/{lastResult.total} ({lastResult.percentage}%)
          </div>
        )}
      </div>

      {!submitted ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Progress Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>
                Question {currentIndex + 1} of {total}
              </span>
              <span>
                {answeredCount} of {total} answered
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>

            {/* Question Stepper Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {QUIZ_QUESTIONS.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                        : isAnswered
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {currentQuestion.question}
            </h3>

            <div className="mt-5 space-y-3">
              {currentQuestion.options.map((option, optIndex) => {
                const selected = answers[currentQuestion.id] === optIndex;
                const letter = String.fromCharCode(65 + optIndex);
                return (
                  <button
                    key={optIndex}
                    type="button"
                    onClick={() => selectOption(currentQuestion.id, optIndex)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${
                      selected
                        ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 text-slate-900 dark:text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/50 text-slate-700 dark:text-slate-300 hover:border-indigo-400/50'
                    }`}
                  >
                    <span
                      className={`h-6 w-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-sm font-medium leading-relaxed">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-sm font-semibold shadow-md transition-all"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {allAnswered ? 'Submit Quiz' : `Answer all ${total} to Submit`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Score Summary Card */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-navy-900 to-indigo-950 text-white p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <Award className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Final Quiz Result
                </div>
                <div className="text-3xl font-extrabold mt-0.5">
                  {computedScore} / {total} Correct ({percentage}%)
                </div>
                <p className="text-sm text-slate-300 mt-1">
                  {percentage >= 80
                    ? 'Excellent mastery of Prompt Engineering & RAG fundamentals!'
                    : percentage >= 60
                    ? 'Good job! Review the explanations below to lock in the concepts.'
                    : 'Keep practicing! Read each explanation carefully and try again.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-navy-950 font-semibold text-sm hover:bg-slate-100 transition-colors shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart Quiz</span>
            </button>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-4">
            {QUIZ_QUESTIONS.map((q, idx) => {
              const userChoice = answers[q.id];
              const isCorrect = userChoice === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-5 bg-white dark:bg-navy-900 ${
                    isCorrect
                      ? 'border-emerald-500/30'
                      : 'border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {idx + 1}. {q.question}
                    </h4>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" /> Incorrect
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs sm:text-sm">
                    <div className="text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Your answer: </span>
                      <span
                        className={
                          isCorrect
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-rose-600 dark:text-rose-400 font-medium'
                        }
                      >
                        {q.options[userChoice]}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div className="text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">Correct answer: </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {q.options[q.correctIndex]}
                        </span>
                      </div>
                    )}
                    <p className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-navy-800/70 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Explanation:{' '}
                      </span>
                      {q.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
