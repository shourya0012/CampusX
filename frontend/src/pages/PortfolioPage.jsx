import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Linkedin,
  Globe,
  GraduationCap,
  Code2,
  FolderGit2,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  RotateCcw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

function validateSocialUrl(rawValue, kind) {
  const value = (rawValue || '').trim();
  if (!value) {
    return { valid: true, normalized: '' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return {
      valid: false,
      error: 'Enter a valid URL starting with https:// or http://',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'URL must start with https:// or http://',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || (!host.includes('.') && host !== 'localhost')) {
    return {
      valid: false,
      error: 'Enter a complete URL with a valid domain name (e.g. https://example.com)',
    };
  }

  if (kind === 'github' && host !== 'github.com' && !host.endsWith('.github.com')) {
    return {
      valid: false,
      error: 'Enter a valid GitHub URL (e.g. https://github.com/yourusername)',
    };
  }

  if (kind === 'linkedin' && host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) {
    return {
      valid: false,
      error: 'Enter a valid LinkedIn URL (e.g. https://linkedin.com/in/yourusername)',
    };
  }

  return { valid: true, normalized: value };
}

function isSafeExternalUrl(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function PortfolioPage({ portfolio, onSavePortfolio, onResetPortfolio }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(portfolio);
  const [socialErrors, setSocialErrors] = useState({});

  const startEdit = () => {
    const copy = JSON.parse(JSON.stringify(portfolio));
    copy.socials = {
      github: copy.socials?.github || '',
      linkedin: copy.socials?.linkedin || '',
      website: copy.socials?.website || '',
    };
    setDraft(copy);
    setSocialErrors({});
    setIsEditing(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const checks = {
      github: validateSocialUrl(draft.socials?.github, 'github'),
      linkedin: validateSocialUrl(draft.socials?.linkedin, 'linkedin'),
      website: validateSocialUrl(draft.socials?.website, 'website'),
    };

    const nextErrors = {};
    for (const key of ['github', 'linkedin', 'website']) {
      if (!checks[key].valid) {
        nextErrors[key] = checks[key].error;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setSocialErrors(nextErrors);
      return;
    }

    setSocialErrors({});
    onSavePortfolio({
      ...draft,
      socials: {
        github: checks.github.normalized,
        linkedin: checks.linkedin.normalized,
        website: checks.website.normalized,
      },
    });
    setIsEditing(false);
  };

  const initials = (portfolio.name || 'CX')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const updateListItem = (field, index, key, value) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addListItem = (field, newItem) => {
    setDraft((prev) => ({
      ...prev,
      [field]: [...prev[field], newItem],
    }));
  };

  const removeListItem = (field, index) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            AI Personal Portfolio
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customize your developer profile, skills, education, and projects — saved in your browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={onResetPortfolio}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Sample</span>
              </button>
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Mode Form */}
      {isEditing ? (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-indigo-500/30 bg-white dark:bg-navy-900 p-6 shadow-lg space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Headline / Role
              </label>
              <input
                type="text"
                required
                value={draft.headline}
                onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Profile Photo URL (optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={draft.avatarUrl}
                onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              About Me
            </label>
            <textarea
              rows={3}
              value={draft.about}
              onChange={(e) => setDraft({ ...draft, about: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="portfolio-github-url"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                GitHub Profile URL (optional)
              </label>
              <div className="relative">
                <input
                  id="portfolio-github-url"
                  type="text"
                  inputMode="url"
                  placeholder="https://github.com/yourusername"
                  value={draft.socials?.github || ''}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      socials: { ...draft.socials, github: e.target.value },
                    });
                    if (socialErrors.github) {
                      setSocialErrors((prev) => ({ ...prev, github: '' }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-navy-800 px-3.5 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    socialErrors.github
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                />
                {draft.socials?.github && (
                  <button
                    type="button"
                    aria-label="Remove GitHub URL"
                    onClick={() => {
                      setDraft({ ...draft, socials: { ...draft.socials, github: '' } });
                      setSocialErrors((prev) => ({ ...prev, github: '' }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {socialErrors.github && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{socialErrors.github}</span>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="portfolio-linkedin-url"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                LinkedIn Profile URL (optional)
              </label>
              <div className="relative">
                <input
                  id="portfolio-linkedin-url"
                  type="text"
                  inputMode="url"
                  placeholder="https://linkedin.com/in/yourusername"
                  value={draft.socials?.linkedin || ''}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      socials: { ...draft.socials, linkedin: e.target.value },
                    });
                    if (socialErrors.linkedin) {
                      setSocialErrors((prev) => ({ ...prev, linkedin: '' }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-navy-800 px-3.5 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    socialErrors.linkedin
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                />
                {draft.socials?.linkedin && (
                  <button
                    type="button"
                    aria-label="Remove LinkedIn URL"
                    onClick={() => {
                      setDraft({ ...draft, socials: { ...draft.socials, linkedin: '' } });
                      setSocialErrors((prev) => ({ ...prev, linkedin: '' }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {socialErrors.linkedin && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{socialErrors.linkedin}</span>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="portfolio-website-url"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Personal Website URL (optional)
              </label>
              <div className="relative">
                <input
                  id="portfolio-website-url"
                  type="text"
                  inputMode="url"
                  placeholder="https://yourwebsite.com"
                  value={draft.socials?.website || ''}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      socials: { ...draft.socials, website: e.target.value },
                    });
                    if (socialErrors.website) {
                      setSocialErrors((prev) => ({ ...prev, website: '' }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-navy-800 px-3.5 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    socialErrors.website
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                />
                {draft.socials?.website && (
                  <button
                    type="button"
                    aria-label="Remove Personal Website URL"
                    onClick={() => {
                      setDraft({ ...draft, socials: { ...draft.socials, website: '' } });
                      setSocialErrors((prev) => ({ ...prev, website: '' }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {socialErrors.website && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{socialErrors.website}</span>
                </p>
              )}
            </div>
          </div>

          {/* Skills Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Technical Skills
              </h4>
              <button
                type="button"
                onClick={() =>
                  addListItem('skills', {
                    id: `sk-${Date.now()}`,
                    name: 'New Skill',
                    category: 'General',
                    level: 75,
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" /> Add Skill
              </button>
            </div>
            <div className="space-y-2">
              {draft.skills.map((skill, idx) => (
                <div key={skill.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={skill.name}
                    onChange={(e) => updateListItem('skills', idx, 'name', e.target.value)}
                    placeholder="Skill name"
                    className="col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={skill.category}
                    onChange={(e) => updateListItem('skills', idx, 'category', e.target.value)}
                    placeholder="Category"
                    className="col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={skill.level}
                    onChange={(e) =>
                      updateListItem('skills', idx, 'level', Number(e.target.value) || 0)
                    }
                    className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeListItem('skills', idx)}
                    className="col-span-1 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                    aria-label="Remove skill"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Programming Languages Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Programming Languages
              </h4>
              <button
                type="button"
                onClick={() =>
                  addListItem('languages', {
                    id: `lang-${Date.now()}`,
                    name: 'TypeScript',
                    level: 70,
                    tag: 'Web Dev',
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" /> Add Language
              </button>
            </div>
            <div className="space-y-2">
              {draft.languages.map((lang, idx) => (
                <div key={lang.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={lang.name}
                    onChange={(e) => updateListItem('languages', idx, 'name', e.target.value)}
                    placeholder="Language"
                    className="col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={lang.tag}
                    onChange={(e) => updateListItem('languages', idx, 'tag', e.target.value)}
                    placeholder="Focus"
                    className="col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={lang.level}
                    onChange={(e) =>
                      updateListItem('languages', idx, 'level', Number(e.target.value) || 0)
                    }
                    className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeListItem('languages', idx)}
                    className="col-span-1 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                    aria-label="Remove language"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Education Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Education</h4>
              <button
                type="button"
                onClick={() =>
                  addListItem('education', {
                    id: `edu-${Date.now()}`,
                    degree: 'Degree / Course',
                    institution: 'University / School Name',
                    period: '2024 – 2028',
                    grade: 'CGPA / Percentage',
                    highlights: 'Key subjects or achievements',
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" /> Add Education
              </button>
            </div>
            <div className="space-y-3">
              {draft.education.map((edu, idx) => (
                <div
                  key={edu.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateListItem('education', idx, 'degree', e.target.value)}
                      placeholder="Degree"
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs font-semibold"
                    />
                    <input
                      type="text"
                      value={edu.period}
                      onChange={(e) => updateListItem('education', idx, 'period', e.target.value)}
                      placeholder="Period"
                      className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeListItem('education', idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                      aria-label="Remove education"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) =>
                        updateListItem('education', idx, 'institution', e.target.value)
                      }
                      placeholder="Institution"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={edu.grade}
                      onChange={(e) => updateListItem('education', idx, 'grade', e.target.value)}
                      placeholder="Grade / CGPA"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={edu.highlights}
                    onChange={(e) =>
                      updateListItem('education', idx, 'highlights', e.target.value)
                    }
                    placeholder="Highlights / Coursework"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Projects Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Projects</h4>
              <button
                type="button"
                onClick={() =>
                  addListItem('projects', {
                    id: `proj-${Date.now()}`,
                    title: 'New Project',
                    tag: 'Web App',
                    description: 'Describe what you built and the problem it solves.',
                    tech: ['React', 'Python'],
                    link: '',
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" /> Add Project
              </button>
            </div>
            <div className="space-y-3">
              {draft.projects.map((proj, idx) => (
                <div
                  key={proj.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={proj.title}
                      onChange={(e) => updateListItem('projects', idx, 'title', e.target.value)}
                      placeholder="Project title"
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs font-semibold"
                    />
                    <input
                      type="text"
                      value={proj.tag}
                      onChange={(e) => updateListItem('projects', idx, 'tag', e.target.value)}
                      placeholder="Tag"
                      className="w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeListItem('projects', idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                      aria-label="Remove project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={proj.description}
                    onChange={(e) => updateListItem('projects', idx, 'description', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={(proj.tech || []).join(', ')}
                      onChange={(e) =>
                        updateListItem(
                          'projects',
                          idx,
                          'tech',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="Tech stack (comma-separated)"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="url"
                      value={proj.link}
                      onChange={(e) => updateListItem('projects', idx, 'link', e.target.value)}
                      placeholder="Project URL"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-md"
            >
              <Save className="h-4 w-4" />
              <span>Save Portfolio</span>
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Hero Card */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {portfolio.avatarUrl ? (
                <img
                  src={portfolio.avatarUrl}
                  alt={portfolio.name}
                  className="h-24 w-24 rounded-2xl object-cover ring-4 ring-indigo-500/20 shadow-lg"
                />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center text-3xl font-extrabold text-white shadow-lg shadow-indigo-500/25 shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {portfolio.name}
                </h3>
                <p className="mt-1 text-sm sm:text-base font-medium text-indigo-600 dark:text-indigo-400">
                  {portfolio.headline}
                </p>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                  {portfolio.location && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-800">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                      {portfolio.location}
                    </span>
                  )}
                  {portfolio.email && (
                    <a
                      href={`mailto:${portfolio.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-800 hover:bg-indigo-500/10 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-indigo-500" />
                      {portfolio.email}
                    </a>
                  )}
                  {portfolio.phone && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-800">
                      <Phone className="h-3.5 w-3.5 text-indigo-500" />
                      {portfolio.phone}
                    </span>
                  )}
                </div>

                {/* Social Links */}
                {(isSafeExternalUrl(portfolio.socials?.github) ||
                  isSafeExternalUrl(portfolio.socials?.linkedin) ||
                  isSafeExternalUrl(portfolio.socials?.website)) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isSafeExternalUrl(portfolio.socials?.github) && (
                      <a
                        href={portfolio.socials.github.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-500/50 transition-colors"
                      >
                        <Github className="h-3.5 w-3.5" />
                        GitHub
                      </a>
                    )}
                    {isSafeExternalUrl(portfolio.socials?.linkedin) && (
                      <a
                        href={portfolio.socials.linkedin.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-500/50 transition-colors"
                      >
                        <Linkedin className="h-3.5 w-3.5 text-sky-500" />
                        LinkedIn
                      </a>
                    )}
                    {isSafeExternalUrl(portfolio.socials?.website) && (
                      <a
                        href={portfolio.socials.website.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-500/50 transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5 text-emerald-500" />
                        Website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                About Me
              </h4>
              <p className="mt-2 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                {portfolio.about}
              </p>
            </div>
          </section>

          {/* Technical Skills & Programming Languages */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Code2 className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Technical Skills
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {portfolio.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60 hover:-translate-y-0.5 hover:border-indigo-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {skill.name}
                      </span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {skill.level}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {skill.category}
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, skill.level))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
                Programming Languages
              </h3>
              <div className="space-y-4">
                {portfolio.languages.map((lang) => (
                  <div key={lang.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {lang.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {lang.tag}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                        style={{ width: `${lang.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Education */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <GraduationCap className="h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Education</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {portfolio.education.map((edu) => (
                <div
                  key={edu.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {edu.degree}
                    </h4>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      {edu.period}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                    {edu.institution}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">
                    {edu.grade}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {edu.highlights}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Projects */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <FolderGit2 className="h-5 w-5 text-cyan-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Featured Projects
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {portfolio.projects.map((project) => (
                <div
                  key={project.id}
                  className="group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60 p-5 hover:-translate-y-1 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        {project.tag}
                      </span>
                      {project.link && (
                        <a
                          href={project.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-indigo-500 transition-colors"
                          aria-label={`Open ${project.title}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                      {project.title}
                    </h4>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(project.tech || []).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
