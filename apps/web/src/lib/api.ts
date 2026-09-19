const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('radiolive_token');
}

export function setToken(token: string) {
  localStorage.setItem('radiolive_token', token);
}

export function removeToken() {
  localStorage.removeItem('radiolive_token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('radiolive_user');
  return user ? JSON.parse(user) : null;
}

export function setUser(user: any) {
  localStorage.setItem('radiolive_user', JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem('radiolive_user');
}
