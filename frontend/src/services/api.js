const DEFAULT_PRODUCTION_API_URL = 'https://campusx-w5tq.onrender.com';
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_URL : '')
).replace(/\/$/, '');

let getAuthToken = async () => null;

export function setAuthTokenProvider(providerFn) {
  getAuthToken = typeof providerFn === 'function' ? providerFn : async () => null;
}

async function request(path, options = {}, { requireAuth = true } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  if (requireAuth) {
    const token = await getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    const targetLabel = API_BASE_URL || 'http://127.0.0.1:8000';
    throw new Error(
      `Unable to reach the CampusX backend API (${targetLabel}). If the Render service is waking up, please retry in a few seconds.`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      (typeof data === 'object' && (data.detail || data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export function checkHealth() {
  return request('/api/health', {}, { requireAuth: false });
}

export function fetchCurrentBackendUser() {
  return request('/api/auth/me');
}

export function fetchWeather(city) {
  const encoded = encodeURIComponent(city.trim());
  return request(`/api/weather?city=${encoded}`);
}

export function sendChatMessage({ messages, temperature }) {
  return request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature }),
  });
}

export function uploadPdfDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/rag/upload', {
    method: 'POST',
    body: formData,
  });
}

export function listRagDocuments() {
  return request('/api/rag/documents');
}

export function deleteRagDocument(documentId) {
  return request(`/api/rag/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export function askRagQuestion({ question, documentId = null, topK = 4 }) {
  return request('/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      document_id: documentId || null,
      top_k: topK,
    }),
  });
}

export function parseVoiceStudyTranscript({ transcript, language = 'en-IN', todayDate = null }) {
  return request('/api/voice-study/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      language,
      today_date: todayDate,
    }),
  });
}

export function transcribeVoiceAudio({ audioBlob, filename = 'recording.webm', language = 'en-IN' }) {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('language', language);
  return request('/api/voice-study/transcribe', {
    method: 'POST',
    body: formData,
  });
}

export function generateVoiceStudyBundle({
  transcript,
  requirements,
  language = 'en-IN',
  todayDate = null,
}) {
  return request('/api/voice-study/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      requirements,
      language,
      today_date: todayDate,
    }),
  });
}
