import { useState, useRef } from 'react';
import {
  FileUp,
  FileText,
  Trash2,
  Send,
  Loader2,
  AlertCircle,
  BookOpen,
  Layers,
  Database,
  Search,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Building2,
  GraduationCap,
  Users,
  Info,
} from 'lucide-react';
import {
  uploadPdfDocument,
  deleteRagDocument,
  askRagQuestion,
} from '../services/api.js';

const RAG_STAGES = [
  { step: '1. Load', detail: 'Extract text per page via PyPDF', icon: FileText },
  { step: '2. Chunk', detail: 'Split into 750-char chunks (150 overlap)', icon: Layers },
  { step: '3. Embed', detail: 'Encode vectors via Sentence Transformers', icon: Sparkles },
  { step: '4. Store', detail: 'Persist vectors & metadata in ChromaDB', icon: Database },
  { step: '5. Retrieve', detail: 'Semantic cosine Top-K similarity search', icon: Search },
  { step: '6. Generate', detail: 'Send grounded context + query to Gemini', icon: Sparkles },
  { step: '7. Display', detail: 'Show answer with page sources & gaps', icon: BookOpen },
];

const BUSINESS_USE_CASES = [
  {
    title: '1. Customer Support',
    icon: Building2,
    accent: 'from-indigo-500 to-blue-500',
    summary:
      'Retrieve accurate answers directly from company refund policies, warranty terms, and product troubleshooting manuals.',
    example:
      'Support agents or self-serve widgets cite exact policy sections instead of guessing.',
  },
  {
    title: '2. Education & Student Learning',
    icon: GraduationCap,
    accent: 'from-purple-500 to-pink-500',
    summary:
      'Allow students to upload lecture slides, research papers, and textbooks to ask clarifying questions with page citations.',
    example:
      'Directly powers CampusX Document AI for exam prep and revision.',
  },
  {
    title: '3. Human Resources (HR)',
    icon: Users,
    accent: 'from-emerald-500 to-cyan-500',
    summary:
      'Query employee handbooks, leave policies, onboarding guides, and internal compliance documents instantly.',
    example:
      'New hires find exact leave or benefits rules with source page references.',
  },
];

export default function RagPage({
  documents,
  onDocumentsChange,
  healthStatus,
}) {
  const [activeTab, setActiveTab] = useState('assistant');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [topK, setTopK] = useState(4);
  const [question, setQuestion] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState('');
  const [ragResult, setRagResult] = useState(null);

  const fileInputRef = useRef(null);
  const geminiConfigured = healthStatus?.integrations?.gemini_configured;

  const handleFileSelected = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid .pdf file.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadNotice('');

    try {
      const created = await uploadPdfDocument(file);
      await onDocumentsChange();
      setSelectedDocId(created.document_id);
      setUploadNotice(
        `Indexed "${created.filename}" (${created.total_pages} pages, ${created.chunk_count} chunks stored in ChromaDB).`
      );
    } catch (err) {
      setError(err.message || 'Failed to process and index PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    setError('');
    try {
      await deleteRagDocument(docId);
      if (selectedDocId === docId) setSelectedDocId('');
      await onDocumentsChange();
    } catch (err) {
      setError(err.message || 'Could not remove document.');
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || queryLoading) return;

    setQueryLoading(true);
    setError('');
    setRagResult(null);

    try {
      const res = await askRagQuestion({
        question: q,
        documentId: selectedDocId || null,
        topK,
      });
      setRagResult(res);
    } catch (err) {
      setError(err.message || 'Failed to query RAG pipeline.');
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Document AI / RAG Assistant
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            7-stage Retrieval-Augmented Generation with PyPDF, Sentence Transformers, ChromaDB, and
            Google Gemini.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'assistant'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Document Q&A
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'workflow'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Workflow Diagram & Use Cases
          </button>
        </div>
      </div>

      {activeTab === 'workflow' ? (
        <div className="space-y-6">
          {/* Visual 7-Stage Pipeline Diagram */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                End-to-End RAG Architecture Workflow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                PDF Upload → Load → Chunk → Embed → Store in ChromaDB → User Query → Retrieve
                Relevant Chunks → Gemini Generate → Answer with Sources
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {RAG_STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.step}
                    className="relative rounded-xl border border-indigo-500/20 bg-slate-50 dark:bg-navy-800/70 p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      {idx < RAG_STAGES.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-slate-400 hidden lg:block" />
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {stage.step}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {stage.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Three Real-World Business Use Cases */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Real-World Business Use Cases
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BUSINESS_USE_CASES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-3"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.accent} text-white flex items-center justify-center`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.summary}
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800/70 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Impact:{' '}
                      </span>
                      {item.example}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: PDF Upload & Document Library */}
          <div className="lg:col-span-5 space-y-4">
            {/* Upload Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                1. Upload & Index PDF
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-2xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 p-6 text-center transition-all disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Running Load → Chunk → Embed → Store...
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      First upload may take a moment while loading the embedding model.
                    </div>
                  </>
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Click to Choose a PDF Document
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Max 15 MB • Text extracted via PyPDF & stored in ChromaDB
                    </div>
                  </>
                )}
              </button>

              {uploadNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadNotice}</span>
                </div>
              )}
            </div>

            {/* Indexed Document List */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Indexed Documents ({documents.length})
                </h3>
                {documents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDocId('')}
                    className={`text-xs font-semibold ${
                      selectedDocId === ''
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Search All
                  </button>
                )}
              </div>

              {documents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No PDFs indexed yet. Upload lecture notes, a syllabus, or a study guide to get
                  started.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const isSelected = selectedDocId === doc.document_id;
                    return (
                      <div
                        key={doc.document_id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDocId(isSelected ? '' : doc.document_id)
                          }
                          className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                        >
                          <FileText className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {doc.filename}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {doc.total_pages} pages • {doc.chunk_count} chunks
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.document_id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          aria-label={`Delete ${doc.filename}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Query & Grounded Answer */}
          <div className="lg:col-span-7 space-y-4">
            {healthStatus && !geminiConfigured && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Gemini API Key Not Configured: </span>
                  ChromaDB Load, Chunk, Embed, Store, and Retrieve stages work locally right now!
                  Add <code>GEMINI_API_KEY</code> to <code>backend/.env</code> to also enable Stage 6
                  natural-language answer generation.
                </div>
              </div>
            )}

            <form
              onSubmit={handleAsk}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Ask Questions About Your PDFs
                </h3>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Top-K Chunks:</span>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-2 py-1 text-xs font-semibold"
                  >
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Scope:{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedDocId
                    ? documents.find((d) => d.document_id === selectedDocId)?.filename ||
                      'Selected PDF'
                    : 'All Indexed PDFs'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a specific question about your uploaded document..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={queryLoading || !question.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all"
                >
                  {queryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{queryLoading ? 'Retrieving...' : 'Ask AI'}</span>
                </button>
              </div>
            </form>

            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {ragResult && (
              <div className="space-y-4">
                {/* Answer Card */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {ragResult.generated_by_ai
                        ? `Grounded Answer (${ragResult.model})`
                        : 'Retrieval Result (Gemini Generation Pending Key)'}
                    </span>

                    {ragResult.insufficient_context && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        Limited / Insufficient Document Context
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {ragResult.answer}
                  </p>
                </div>

                {/* Retrieved Sources */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Retrieved Sources from ChromaDB ({ragResult.sources.length})
                  </h4>
                  <div className="space-y-3">
                    {ragResult.sources.map((src, idx) => (
                      <div
                        key={`${src.document_id}-${src.chunk_index}-${idx}`}
                        className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/60 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {src.filename} — Page {src.page_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold">
                            Similarity: {(src.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {src.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
