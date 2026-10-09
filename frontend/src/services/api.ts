const configuredApiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
export const API_ORIGIN = configuredApiOrigin;
export const API_BASE = configuredApiOrigin ? `${configuredApiOrigin}/api/v1` : '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('statusforge_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || data.message || 'Request failed';
    const errorCode = data.error?.code || 'API_ERROR';
    throw new ApiError(errorMsg, errorCode, response.status, data.error?.details);
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Auth
  auth: {
    signup: (payload: any) => request<any>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    login: (credentials: { email: string; password: string }) =>
      request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    me: () => request<any>('/auth/me'),
    demoSwitch: (payload: { targetUserId?: string; targetRole?: string }) =>
      request<any>('/auth/demo-switch', { method: 'POST', body: JSON.stringify(payload) }),
    forgotPassword: (email: string) =>
      request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (payload: { token: string; newPassword: string }) =>
      request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
    acceptInvitation: (payload: { token: string; password: string }) =>
      request<any>('/auth/accept-invitation', { method: 'POST', body: JSON.stringify(payload) }),
    googleAuth: (payload: { credential: string }) =>
      request<any>('/auth/google', { method: 'POST', body: JSON.stringify(payload) }),
  },

  // Users
  users: {
    list: () => request<any[]>('/users'),
    create: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/users/${id}`, { method: 'DELETE' }),
  },

  // Services
  services: {
    list: () => request<any[]>('/services'),
    create: (data: any) => request<any>('/services', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/services/${id}`, { method: 'DELETE' }),
    rotateWebhook: (id: string) => request<any>(`/services/${id}/rotate-webhook`, { method: 'POST' }),
  },

  // Schedules
  schedules: {
    list: () => request<any[]>('/schedules'),
    create: (data: any) => request<any>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Escalation Policies
  policies: {
    list: () => request<any[]>('/policies'),
    create: (data: any) => request<any>('/policies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Incidents
  incidents: {
    list: (params?: { status?: string; severity?: string; serviceId?: string }) => {
      const search = new URLSearchParams();
      if (params?.status) search.set('status', params.status);
      if (params?.severity) search.set('severity', params.severity);
      if (params?.serviceId) search.set('serviceId', params.serviceId);
      const query = search.toString() ? `?${search.toString()}` : '';
      return request<any[]>(`/incidents${query}`);
    },
    get: (id: string) => request<any>(`/incidents/${id}`),
    create: (data: any) => request<any>('/incidents', { method: 'POST', body: JSON.stringify(data) }),
    acknowledge: (id: string) => request<any>(`/incidents/${id}/acknowledge`, { method: 'POST' }),
    resolve: (id: string, data?: { rootCauseSummary?: string }) =>
      request<any>(`/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify(data || {}) }),
    escalate: (id: string) => request<any>(`/incidents/${id}/escalate`, { method: 'POST' }),
    addComment: (id: string, message: string) =>
      request<any>(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  },

  // Webhook Simulator
  webhooks: {
    trigger: async (serviceId: string, secret: string, payload: any) => {
      const res = await fetch(`${API_BASE}/webhooks/services/${serviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret,
        },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
  },

  // Analytics & Audit
  analytics: {
    overview: () => request<any>('/analytics/overview'),
  },
  auditLogs: {
    list: () => request<any[]>('/audit-logs'),
  },

  // Public status
  public: {
    getStatus: async (slug: string) => {
      const res = await fetch(`${API_BASE}/public/status/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new ApiError(data.error?.message || 'Failed to fetch status page', 'NOT_FOUND', res.status);
      }
      return data.data;
    },
  },
};
