import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Pin,
  Pencil,
  Trash2,
  StickyNote,
  Save,
  X,
} from 'lucide-react';

const CATEGORIES = ['All', 'Prompt Eng', 'AI & RAG', 'Coding', 'Exam Prep', 'General'];

export default function NotesPage({ notes, onSaveNotes }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Prompt Eng');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setEditingNoteId(null);
    setTitle('');
    setCategory('Prompt Eng');
    setContent('');
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError('Please enter both a note title and content.');
      return;
    }

    const now = new Date().toISOString();
    if (editingNoteId) {
      onSaveNotes(
        notes.map((n) =>
          n.id === editingNoteId
            ? { ...n, title: title.trim(), category, content: content.trim(), updatedAt: now }
            : n
        )
      );
    } else {
      const newNote = {
        id: `note-${Date.now()}`,
        title: title.trim(),
        category,
        content: content.trim(),
        pinned: false,
        updatedAt: now,
      };
      onSaveNotes([newNote, ...notes]);
    }
    resetForm();
  };

  const startEditing = (note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setCategory(note.category || 'General');
    setContent(note.content);
    setFormError('');
  };

  const togglePin = (id) => {
    onSaveNotes(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };

  const deleteNote = (id) => {
    if (editingNoteId === id) resetForm();
    onSaveNotes(notes.filter((n) => n.id !== id));
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        const matchesCat = selectedCategory === 'All' || n.category === selectedCategory;
        const matchesQuery =
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.category || '').toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [notes, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Smart Notes</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create, search, pin, edit, and organize your study notes with instant browser persistence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create / Edit Note Panel */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingNoteId ? 'Edit Note' : 'Create New Note'}
            </h3>
            {editingNoteId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-500">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Note Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chain-of-Thought Prompting Notes"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Content
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write lecture highlights, code snippets, or exam revision points..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md transition-all"
          >
            {editingNoteId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{editingNoteId ? 'Save Changes' : 'Add Note'}</span>
          </button>
        </form>

        {/* Search & Notes List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-4 shadow-sm space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, keyword, or tag..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <StickyNote className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No matching notes found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Try clearing your search filter or create a new study note on the left.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className={`rounded-2xl border p-5 bg-white dark:bg-navy-900 shadow-sm transition-all ${
                    note.pinned
                      ? 'border-amber-500/40 ring-1 ring-amber-500/15'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {note.title}
                        </h4>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          {note.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Updated {new Date(note.updatedAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePin(note.id)}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          note.pinned
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                        }`}
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditing(note)}
                        title="Edit note"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        title="Delete note"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {note.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
