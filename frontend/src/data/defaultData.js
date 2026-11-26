export const DEFAULT_PORTFOLIO = {
  name: 'Aarav Sharma',
  headline: 'B.Tech Computer Science & AI Student | Prompt Engineering & Full-Stack Builder',
  location: 'Bengaluru, India',
  avatarUrl: '',
  about:
    'Undergraduate Computer Science student passionate about Retrieval-Augmented Generation (RAG), applied Prompt Engineering, and building clean full-stack web products. Currently exploring how vector databases and structured LLM workflows can make student learning faster and more accessible.',
  email: 'aarav.sharma@campusx.edu',
  phone: '+91 98765 43210',
  socials: {
    github: 'https://github.com/aarav-campusx',
    linkedin: 'https://linkedin.com/in/aarav-campusx',
    website: 'https://campusx-portfolio.example.com',
  },
  education: [
    {
      id: 'edu-1',
      degree: 'B.Tech in Computer Science & Engineering (AI & ML)',
      institution: 'National Institute of Technology & Innovation',
      period: '2023 – 2027',
      grade: 'CGPA: 8.9 / 10.0',
      highlights: 'Coursework: Prompt Engineering, Data Structures, DBMS, Machine Learning, Cloud Systems',
    },
    {
      id: 'edu-2',
      degree: 'Senior Secondary (Class XII — PCM + Computer Science)',
      institution: 'Delhi Public Academy',
      period: '2021 – 2023',
      grade: '94.2%',
      highlights: 'School Coding Club Lead and Science Olympiad Finalist',
    },
  ],
  skills: [
    { id: 'sk-1', name: 'Prompt Engineering & LLM Workflows', category: 'AI Engineering', level: 92 },
    { id: 'sk-2', name: 'RAG Pipelines (ChromaDB & Embeddings)', category: 'AI Engineering', level: 86 },
    { id: 'sk-3', name: 'React & Tailwind CSS', category: 'Frontend', level: 88 },
    { id: 'sk-4', name: 'FastAPI & REST APIs', category: 'Backend', level: 84 },
    { id: 'sk-5', name: 'Git, GitHub & Cloud Deployment', category: 'DevOps', level: 80 },
    { id: 'sk-6', name: 'UI/UX Design & Prototyping', category: 'Design', level: 78 },
  ],
  languages: [
    { id: 'lang-1', name: 'Python', level: 90, tag: 'Primary AI & Backend' },
    { id: 'lang-2', name: 'JavaScript (ES6+)', level: 86, tag: 'Frontend & Web' },
    { id: 'lang-3', name: 'SQL', level: 78, tag: 'Databases' },
    { id: 'lang-4', name: 'HTML5 & CSS3', level: 92, tag: 'UI Markup' },
    { id: 'lang-5', name: 'C++', level: 74, tag: 'DSA & Algorithms' },
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'CampusX — AI Student Hub',
      tag: 'Full-Stack + RAG',
      description:
        'An integrated student productivity platform combining a personal portfolio, Prompt Engineering quiz, live weather dashboard, OpenAI chatbot with temperature control, and a 7-stage PDF RAG assistant.',
      tech: ['React', 'Tailwind CSS', 'FastAPI', 'ChromaDB', 'OpenAI'],
      link: 'https://github.com/aarav-campusx/campusx',
    },
    {
      id: 'proj-2',
      title: 'ExamPrep Vector Search',
      tag: 'NLP & Embeddings',
      description:
        'Semantic search tool for university lecture slides using Sentence Transformers and cosine similarity to pinpoint exact slide paragraphs during exam revision.',
      tech: ['Python', 'Sentence Transformers', 'PyPDF', 'FastAPI'],
      link: 'https://github.com/aarav-campusx/examprep-search',
    },
    {
      id: 'proj-3',
      title: 'PromptLab Evaluator',
      tag: 'Prompt Engineering',
      description:
        'Lightweight benchmark utility comparing zero-shot, few-shot, and chain-of-thought prompt templates across varying temperature parameters.',
      tech: ['JavaScript', 'OpenAI API', 'Vite'],
      link: 'https://github.com/aarav-campusx/promptlab',
    },
  ],
};

export const QUIZ_QUESTIONS = [
  {
    id: 1,
    question:
      'In a Retrieval-Augmented Generation (RAG) pipeline, why do we split extracted PDF text into overlapping chunks before generating embeddings?',
    options: [
      'To delete duplicate words and reduce the PDF file size on disk',
      'To fit model context limits while preserving sentence continuity across chunk boundaries',
      'To convert PDF images into CSS styles for the frontend',
      'To bypass the need for a vector database like ChromaDB',
    ],
    correctIndex: 1,
    explanation:
      'Chunking keeps passages small enough for embedding models and LLM context windows, while overlap prevents ideas split across two boundaries from losing context.',
  },
  {
    id: 2,
    question:
      'How does increasing the LLM temperature parameter from 0.2 to 0.9 typically affect responses in an AI chatbot?',
    options: [
      'It increases output randomness and creativity, while lower values yield more deterministic answers',
      'It makes the Python backend run faster without calling an API',
      'It permanently stores the chat history in localStorage',
      'It lowers the character limit of the user input box',
    ],
    correctIndex: 0,
    explanation:
      'Temperature scales token probability distributions: low values (0.1–0.3) produce focused, deterministic answers, while higher values (0.8–1.0) increase diversity and creativity.',
  },
  {
    id: 3,
    question:
      'Which component in the CampusX RAG stack converts text chunks into dense numerical vectors for semantic similarity search?',
    options: [
      'Tailwind CSS',
      'PyPDF',
      'Sentence Transformers (e.g., all-MiniLM-L6-v2)',
      'localStorage',
    ],
    correctIndex: 2,
    explanation:
      'Sentence Transformers encode text chunks and user queries into vector embeddings so ChromaDB can retrieve semantically similar passages.',
  },
  {
    id: 4,
    question:
      'Why should external API keys such as OPENAI_API_KEY and OPENWEATHER_API_KEY live in backend environment variables instead of React frontend code?',
    options: [
      'React cannot send HTTP requests to any URL',
      'Frontend bundles run in the user browser and would expose secret keys publicly',
      'Environment variables automatically make API calls free of charge',
      'FastAPI cannot parse JSON unless an API key is stored on the server',
    ],
    correctIndex: 1,
    explanation:
      'Anything shipped in a frontend Vite/React bundle can be inspected in browser DevTools. Keeping secrets in backend .env files protects your credentials.',
  },
  {
    id: 5,
    question:
      'In prompt engineering, what is the main advantage of grounding an LLM prompt with retrieved document chunks and page citations?',
    options: [
      'It guarantees the model never needs an internet connection',
      'It reduces hallucinations by constraining answers to verified source context and enables source attribution',
      'It turns a multiple-choice quiz into a weather widget',
      'It removes the need for HTTP error handling',
    ],
    correctIndex: 1,
    explanation:
      'Grounding prompts with retrieved context lets the model answer from your uploaded documents and cite page numbers, or honestly say when information is missing.',
  },
];

export const DEFAULT_NOTES = [
  {
    id: 'note-1',
    title: 'Prompt Engineering Patterns',
    category: 'Prompt Eng',
    pinned: true,
    content:
      'Key patterns to remember for exams:\n1. Role prompting: Assign a clear persona & constraints.\n2. Few-shot examples: Provide 2-3 input/output pairs.\n3. Structured output: Request JSON or clear bullet sections.',
    updatedAt: '2026-11-25T10:30:00.000Z',
  },
  {
    id: 'note-2',
    title: '7-Stage RAG Architecture Checklist',
    category: 'AI & RAG',
    pinned: false,
    content:
      'Stages: Load (PyPDF) -> Chunk (size + overlap) -> Embed (Sentence Transformers) -> Store (ChromaDB) -> Retrieve (Top-K similarity) -> Generate (Gemini grounded prompt) -> Display (Answer + page citations).',
    updatedAt: '2026-11-26T09:15:00.000Z',
  },
];

export const DEFAULT_STUDY_SUBJECTS = [
  {
    id: 'sub-1',
    name: 'Prompt Engineering & RAG Systems',
    hoursNeeded: 6,
    priority: 'High',
    deadline: '2026-12-02',
  },
  {
    id: 'sub-2',
    name: 'Data Structures & Algorithms',
    hoursNeeded: 5,
    priority: 'Medium',
    deadline: '2026-12-05',
  },
  {
    id: 'sub-3',
    name: 'FastAPI & Cloud Deployment',
    hoursNeeded: 4,
    priority: 'Medium',
    deadline: '2026-12-07',
  },
];
