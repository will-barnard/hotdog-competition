const API_BASE = '/api';

function getHeaders(includeAuth = false) {
  const headers = {};
  if (includeAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function request(url, options = {}) {
  const res = await fetch(API_BASE + url, options);
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const auth = {
  async register(username, email, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async me() {
    return request('/auth/me', { headers: getHeaders(true) });
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  }
};

export const hotdogs = {
  async create(formData) {
    const res = await fetch(API_BASE + '/hotdogs', {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create');
    return data;
  },

  async feed(page = 1, limit = 20) {
    return request(`/hotdogs/feed?page=${page}&limit=${limit}`, {
      headers: getHeaders(true)
    });
  },

  async myFeed(page = 1, limit = 20) {
    return request(`/hotdogs/my-feed?page=${page}&limit=${limit}`, {
      headers: getHeaders(true)
    });
  },

  async get(id) {
    return request(`/hotdogs/${id}`, { headers: getHeaders(true) });
  },

  async delete(id) {
    return request(`/hotdogs/${id}`, {
      method: 'DELETE',
      headers: getHeaders(true)
    });
  }
};

export const leaderboard = {
  async overall() {
    return request('/leaderboard/overall');
  },

  async competitors() {
    return request('/leaderboard/competitors');
  }
};

export const settings = {
  async get() {
    return request('/settings');
  },

  async update(data) {
    return request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify(data)
    });
  }
};

export const admin = {
  async getUsers() {
    return request('/admin/users', { headers: getHeaders(true) });
  },

  async updateUser(id, data) {
    return request(`/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify(data)
    });
  },

  async getHotdogs(page = 1, limit = 20) {
    return request(`/admin/hotdogs?page=${page}&limit=${limit}`, {
      headers: getHeaders(true)
    });
  },

  async updateHotdog(id, data) {
    return request(`/admin/hotdogs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify(data)
    });
  },

  async deleteHotdog(id) {
    return request(`/admin/hotdogs/${id}`, {
      method: 'DELETE',
      headers: getHeaders(true)
    });
  }
};
