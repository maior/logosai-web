/**
 * logos_api 클라이언트
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

export const API_BASE = `${API_URL}/api/${API_VERSION}`;

/**
 * JWT 토큰 관리
 */
export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('logos_token');
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('logos_token', token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('logos_token');
  },

  getEmail: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('logos_email');
  },

  setEmail: (email: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('logos_email', email);
  },
};

/**
 * API 요청 헤더
 * Supports both JWT token and email-based authentication for OAuth users.
 */
export function getHeaders(): HeadersInit {
  const token = tokenManager.getToken();
  const email = tokenManager.getEmail();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(email ? { 'X-User-Email': email } : {}),
  };
}

/**
 * Health Check
 */
export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}

/**
 * 세션 목록 조회
 */
export async function getSessions(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/sessions`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch sessions');
  const data = await response.json();
  return data.sessions || [];
}

/**
 * 세션 상세 조회
 */
export async function getSession(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch session');
  return response.json();
}

/**
 * 세션 메시지 조회
 */
export async function getSessionMessages(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}

/**
 * 새 세션 생성
 */
export async function createSession(title?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
}

/**
 * 파일 업로드 (RAG 자동 저장)
 */
export interface UploadedFile {
  file_id: string;
  project_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  upload_at: string | null;
}

export interface UploadResponse {
  file: UploadedFile;
  message: string;
}

export async function uploadFileForRAG(
  file: File,
  projectId: string = 'default',
  projectName?: string,
  autoProcess: boolean = true
): Promise<UploadResponse> {
  const token = tokenManager.getToken();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);
  if (projectName) {
    formData.append('project_name', projectName);
  }
  formData.append('auto_process', autoProcess.toString());

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      // Note: Don't set Content-Type for FormData - browser sets it with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload file');
  }

  return response.json();
}

/**
 * 업로드된 파일 목록 조회
 */
export async function getUploadedFiles(projectId?: string): Promise<{ files: UploadedFile[]; total: number }> {
  const params = new URLSearchParams();
  if (projectId) {
    params.append('project_id', projectId);
  }

  const response = await fetch(`${API_BASE}/documents?${params.toString()}`, {
    headers: getHeaders(),
  });

  if (!response.ok) throw new Error('Failed to fetch files');
  return response.json();
}

/**
 * 파일 삭제
 */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${fileId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) throw new Error('Failed to delete file');
}
