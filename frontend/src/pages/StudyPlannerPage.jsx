import { useState } from 'react';
import {
  CalendarClock,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Pencil,
  Save,
  X,
  Mic,
} from 'lucide-react';
import { DEFAULT_STUDY_SUBJECTS } from '../data/defaultData.js';

const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

const SESSION_TYPE_COLORS = {
  Study: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  Break: 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300',
  Revision: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Practice: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'Mock Test': 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'Final Revision': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

function buildStudySchedule(subjects, dailyHours) {
  if (!subjects.length || dailyHours <= 0) {
    return { days: [], unallocatedHours: 0, totalScheduledHours: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const remaining = subjects
    .map((s) => ({
      ...s,
      remainingHours: Math.max(0.5, Number(s.hoursNeeded) || 1),
      deadlineDate: s.deadline
        ? new Date(`${s.deadline}T00:00:00`)
        : new Date(today.getTime() + 7 * 86400000),
    }))
    .sort((a, b) => {
      const diff = a.deadlineDate.getTime() - b.deadlineDate.getTime();
      if (diff !== 0) return diff;
      return (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1);
    });

  const maxDays = 14;
  const days = [];
  let totalScheduledHours = 0;

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const activeSubjects = remaining.filter((s) => s.remainingHours > 0);
    if (!activeSubjects.length) break;

    const currentDate = new Date(today.getTime() + dayOffset * 86400000);
    let capacity = dailyHours;
    const sessions = [];

    for (const subj of activeSubjects) {
      if (capacity <= 0) break;
      const chunk = Math.min(capacity, subj.remainingHours, 2);
      if (chunk > 0) {
        const roundedChunk = Math.round(chunk * 10) / 10;
        sessions.push({
          id: `sess-${dayOffset}-${subj.id}-${sessions.length}`,
          subjectId: subj.id,
          subjectName: subj.name,
          priority: subj.priority,
          sessionType: 'Study',
          hours: roundedChunk,
          deadline: subj.deadline,
          completed: false,
          focusTip:
            subj.priority === 'High'
              ? 'Deep focus + active recall practice'
              : 'Concept review + summary notes',
        });
        subj.remainingHours = Math.max(
          0,
          Math.round((subj.remainingHours - roundedChunk) * 10) / 10
        );
        capacity = Math.max(0, Math.round((capacity - roundedChunk) * 10) / 10);
        totalScheduledHours += roundedChunk;
      }
    }

    if (sessions.length) {
      days.push({
        date: currentDate.toISOString().slice(0, 10),
        dayLabel: currentDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        sessions,
      });
    }
  }

  const unallocatedHours = remaining.reduce((acc, s) => acc + s.remainingHours, 0);

  return {
    days,
    unallocatedHours: Math.round(unallocatedHours * 10) / 10,
    totalScheduledHours: Math.round(totalScheduledHours * 10) / 10,
  };
}

export default function StudyPlannerPage({ studyPlan, onSaveStudyPlan, onNavigate }) {
  const subjects = studyPlan?.subjects || DEFAULT_STUDY_SUBJECTS;
  const dailyHours = studyPlan?.dailyHours ?? 3;
  const schedule = studyPlan?.schedule || { days: [], unallocatedHours: 0, totalScheduledHours: 0 };

  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState(4);
  const [newPriority, setNewPriority] = useState('High');
  const [newDeadline, setNewDeadline] = useState(() => {
    const d = new Date(Date.now() + 5 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState('');

  const [editingSessionKey, setEditingSessionKey] = useState(null);
  const [sessionDraft, setSessionDraft] = useState({
    subjectName: '',
    startTime: '',
    endTime: '',
    hours: 1,
    focusTip: '',
  });

  const addSubject = (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Please enter a subject name.');
      return;
    }
    setError('');
    const updatedSubjects = [
      ...subjects,
      {
        id: `sub-${Date.now()}`,
        name: newName.trim(),
        hoursNeeded: Math.max(1, Number(newHours) || 1),
        priority: newPriority,
        deadline: newDeadline,
      },
    ];
    onSaveStudyPlan({ ...studyPlan, subjects: updatedSubjects, dailyHours, schedule });
    setNewName('');
  };

  const removeSubject = (id) => {
    const updatedSubjects = subjects.filter((s) => s.id !== id);
    onSaveStudyPlan({ ...studyPlan, subjects: updatedSubjects, dailyHours, schedule });
  };

  const handleGenerate = () => {
    if (!subjects.length) {
      setError('Add at least one subject before generating a study schedule.');
      return;
    }
    setError('');
    const nextSchedule = buildStudySchedule(subjects, Number(dailyHours) || 2);
    onSaveStudyPlan({ subjects, dailyHours, schedule: nextSchedule });
  };

  const updateScheduleDays = (nextDays) => {
    const total = nextDays
      .flatMap((d) => d.sessions)
      .filter((s) => s.sessionType !== 'Break')
      .reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
    onSaveStudyPlan({
      subjects,
      dailyHours,
      schedule: {
        ...schedule,
        days: nextDays.filter((d) => d.sessions.length > 0),
        totalScheduledHours: Math.round(total * 10) / 10,
      },
    });
  };

  const toggleSession = (dayIndex, sessionId) => {
    const nextDays = schedule.days.map((day, idx) =>
      idx === dayIndex
        ? {
            ...day,
            sessions: day.sessions.map((s) =>
              s.id === sessionId ? { ...s, completed: !s.completed } : s
            ),
          }
        : day
    );
    updateScheduleDays(nextDays);
  };

  const deleteSession = (dayIndex, sessionId) => {
    const nextDays = schedule.days.map((day, idx) =>
      idx === dayIndex
        ? { ...day, sessions: day.sessions.filter((s) => s.id !== sessionId) }
        : day
    );
    updateScheduleDays(nextDays);
  };

  const startEditSession = (dayIndex, sess) => {
    setEditingSessionKey(`${dayIndex}:${sess.id}`);
    setSessionDraft({
      subjectName: sess.subjectName || '',
      startTime: sess.startTime || '',
      endTime: sess.endTime || '',
      hours: sess.hours || 1,
      focusTip: sess.focusTip || '',
    });
  };

  const saveEditSession = (dayIndex, sessionId) => {
    const nextDays = schedule.days.map((day, idx) =>
      idx === dayIndex
        ? {
            ...day,
            sessions: day.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    subjectName: sessionDraft.subjectName.trim() || s.subjectName,
                    startTime: sessionDraft.startTime.trim(),
                    endTime: sessionDraft.endTime.trim(),
                    hours: Math.max(0.2, Number(sessionDraft.hours) || s.hours),
                    focusTip: sessionDraft.focusTip.trim(),
                  }
                : s
            ),
          }
        : day
    );
    updateScheduleDays(nextDays);
    setEditingSessionKey(null);
  };

  const allSessions = schedule.days.flatMap((d) => d.sessions);
  const completedCount = allSessions.filter((s) => s.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Study Planner</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter your subjects, deadlines, and daily study hours to generate a prioritized study
            schedule—or dictate your exam plan with Voice Study Assistant.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('voice')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Mic className="h-4 w-4" />
            <span>Plan by Voice</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add Subject & Deadline
            </h3>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-500">
                {error}
              </div>
            )}

            <form onSubmit={addSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Subject / Topic
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Operating Systems"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={newHours}
                    onChange={(e) => setNewHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-2 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Subject
              </button>
            </form>

            {/* Subject List */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Subjects Queue ({subjects.length})
              </div>
              {subjects.map((subj) => (
                <div
                  key={subj.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200/70 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {subj.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {subj.hoursNeeded}h • {subj.priority} • Due {subj.deadline}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubject(subj.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    aria-label={`Remove ${subj.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Daily Availability */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Available Study Hours / Day
                </label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {dailyHours} hrs/day
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={dailyHours}
                onChange={(e) =>
                  onSaveStudyPlan({
                    subjects,
                    dailyHours: Number(e.target.value),
                    schedule,
                  })
                }
                className="w-full accent-indigo-600"
              />

              <button
                type="button"
                onClick={handleGenerate}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate Study Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {/* Generated Schedule View */}
        <div className="lg:col-span-7 space-y-4">
          {schedule.days.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-cyan-500" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {schedule.days.length}-Day Plan ({schedule.totalScheduledHours} total hrs)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {completedCount} of {allSessions.length} sessions completed
                  </div>
                </div>
              </div>

              {schedule.unallocatedHours > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    {schedule.unallocatedHours}h exceeded 14-day window — increase daily hours
                  </span>
                </div>
              )}
            </div>
          )}

          {schedule.days.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <CalendarClock className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No study schedule generated yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Review your subjects and click "Generate Study Schedule" to create your day-by-day
                plan, or use Voice Study Assistant.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedule.days.map((day, dayIdx) => (
                <div
                  key={`${day.date}-${dayIdx}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Day {dayIdx + 1} — {day.dayLabel}
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {Math.round(
                        day.sessions.reduce((sum, s) => sum + (Number(s.hours) || 0), 0) * 10
                      ) / 10}{' '}
                      hrs planned
                    </span>
                  </div>

                  <div className="space-y-2">
                    {day.sessions.map((sess) => {
                      const isEditing = editingSessionKey === `${dayIdx}:${sess.id}`;
                      const typeBadgeClass =
                        SESSION_TYPE_COLORS[sess.sessionType] || SESSION_TYPE_COLORS.Study;
                      return (
                        <div
                          key={sess.id}
                          className={`p-3 rounded-xl border transition-all ${
                            sess.completed
                              ? 'border-emerald-500/30 bg-emerald-500/10 opacity-85'
                              : 'border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={sessionDraft.subjectName}
                                onChange={(e) =>
                                  setSessionDraft({ ...sessionDraft, subjectName: e.target.value })
                                }
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 px-2.5 py-1.5 text-xs font-semibold"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  placeholder="Start (e.g. 06:00 PM)"
                                  value={sessionDraft.startTime}
                                  onChange={(e) =>
                                    setSessionDraft({ ...sessionDraft, startTime: e.target.value })
                                  }
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 px-2.5 py-1.5 text-xs"
                                />
                                <input
                                  type="text"
                                  placeholder="End (e.g. 07:00 PM)"
                                  value={sessionDraft.endTime}
                                  onChange={(e) =>
                                    setSessionDraft({ ...sessionDraft, endTime: e.target.value })
                                  }
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 px-2.5 py-1.5 text-xs"
                                />
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0.2"
                                  value={sessionDraft.hours}
                                  onChange={(e) =>
                                    setSessionDraft({
                                      ...sessionDraft,
                                      hours: Number(e.target.value),
                                    })
                                  }
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 px-2.5 py-1.5 text-xs"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingSessionKey(null)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                                >
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditSession(dayIdx, sess.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                                >
                                  <Save className="h-3.5 w-3.5" /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSession(dayIdx, sess.id)}
                                className="flex items-start gap-3 min-w-0 flex-1 text-left"
                              >
                                {sess.completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Circle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <div
                                    className={`text-sm font-semibold ${
                                      sess.completed
                                        ? 'line-through text-slate-500'
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                                  >
                                    {sess.subjectName}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {sess.startTime && sess.endTime
                                      ? `${sess.startTime} – ${sess.endTime} • `
                                      : ''}
                                    {sess.focusTip}
                                    {sess.deadline ? ` • Due ${sess.deadline}` : ''}
                                  </div>
                                </div>
                              </button>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {sess.sessionType && (
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${typeBadgeClass}`}
                                  >
                                    {sess.sessionType}
                                  </span>
                                )}
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                    sess.priority === 'High'
                                      ? 'bg-rose-500/10 text-rose-500'
                                      : sess.priority === 'Medium'
                                      ? 'bg-amber-500/10 text-amber-500'
                                      : 'bg-sky-500/10 text-sky-500'
                                  }`}
                                >
                                  {sess.priority}
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-1">
                                  {sess.hours}h
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startEditSession(dayIdx, sess)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-500"
                                  aria-label="Edit session"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSession(dayIdx, sess.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500"
                                  aria-label="Delete session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
