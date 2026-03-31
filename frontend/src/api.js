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
  const data = await res.json();
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Unauthorized');
  }
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

  async updateMe(data) {
    return request('/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify(data)
    });
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
    if (!res.ok) {
      if (res.status === 413) throw new Error('Image is too large. Please use a smaller photo.');
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      throw new Error(`Upload failed (${res.status})`);
    }
    return res.json();
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
  },

  async allCompetitors() {
    return request('/leaderboard/all-competitors');
  },

  async breakdown(userId) {
    return request(`/leaderboard/breakdown/${userId}`, { headers: getHeaders(true) });
  }
};

export const settings = {
  async get() {
    return request('/settings');
  },

  async getStats() {
    return request('/settings/stats');
  },

  async update(data) {
    return request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify(data)
    });
  }
};

export const profile = {
  async get(username, page = 1) {
    return request(`/profile/${encodeURIComponent(username)}?page=${page}`);
  },

  async uploadPicture(formData) {
    const res = await fetch(API_BASE + '/profile/picture', {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    if (!res.ok) {
      if (res.status === 413) throw new Error('Image is too large. Please use a smaller photo.');
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload');
      }
      throw new Error(`Upload failed (${res.status})`);
    }
    return res.json();
  }
};

export const admin = {
  async getStats() {
    return request('/admin/stats', { headers: getHeaders(true) });
  },

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

export const comments = {
  async list(hotdogId) {
    return request(`/comments/${hotdogId}`, { headers: getHeaders(true) });
  },

  async create(hotdogId, content) {
    return request(`/comments/${hotdogId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify({ content })
    });
  },

  async delete(commentId) {
    return request(`/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(true)
    });
  }
};

export const ratings = {
  async batch(hotdogIds, userId) {
    if (!hotdogIds.length) return {};
    const params = new URLSearchParams({ ids: hotdogIds.join(',') });
    if (userId) params.set('userId', userId);
    try {
      const data = await request(`/ratings/batch?${params}`, { headers: getHeaders(true) });
      return data.ratings || {};
    } catch (e) {
      console.error('Failed to load ratings:', e);
      return {};
    }
  },

  async rate(hotdogId, stars) {
    return request(`/ratings/${hotdogId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders(true) },
      body: JSON.stringify({ stars })
    });
  },

  async remove(hotdogId) {
    return request(`/ratings/${hotdogId}`, {
      method: 'DELETE',
      headers: getHeaders(true)
    });
  }
};
