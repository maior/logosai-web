/**
 * JWT 인증 유틸리티
 */

import { tokenManager } from './api';

interface JWTPayload {
  sub: string;  // email
  exp: number;
  type: string;
}

/**
 * JWT 토큰 디코딩 (검증 없이)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * 토큰 만료 확인
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * 현재 사용자 이메일 가져오기
 */
export function getCurrentUserEmail(): string | null {
  const token = tokenManager.getToken();
  if (!token) return null;

  const payload = decodeToken(token);
  return payload?.sub || null;
}

/**
 * 인증 상태 확인
 */
export function isAuthenticated(): boolean {
  const token = tokenManager.getToken();
  if (!token) return false;

  return !isTokenExpired(token);
}

/**
 * 로그아웃
 */
export function logout(): void {
  tokenManager.removeToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('logos_email');
  }
}

/**
 * 테스트용 토큰 생성 (개발 환경 전용)
 */
export function generateTestToken(email: string): string {
  // 주의: 이것은 개발/테스트 전용입니다
  // 실제 환경에서는 서버에서 토큰을 발급받아야 합니다
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    sub: email,
    exp: now + 86400, // 24시간
    type: 'access',
  }));

  // 참고: 실제 서명은 서버에서 해야 합니다
  // 이것은 개발 테스트용 더미 서명입니다
  const signature = 'development_signature_not_for_production';

  return `${header}.${payload}.${signature}`;
}
