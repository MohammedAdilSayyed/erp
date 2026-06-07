/* =========================================
   API CLIENT
========================================= */
const API = (() => {
  const TOKEN_KEY = 'erp_token';
  const USER_KEY = 'erp_user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  };
  const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

  async function request(path, { method = 'GET', body, query, headers = {} } = {}) {
    let url = path.startsWith('http') ? path : '/api' + path;
    if (query) {
      const qs = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.append(k, v);
      });
      const s = qs.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}),
        ...headers
      }
    };
    if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);

    const res = await fetch(url, opts);
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();
    else data = await res.text();

    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        if (!path.startsWith('/auth/login')) {
          UI.toast('Session expired — please sign in again', 'warning');
          App.logout();
        }
      }
      const err = new Error((data && data.error && data.error.message) || res.statusText || 'Request failed');
      err.status = res.status;
      err.code = (data && data.error && data.error.code) || 'ERR';
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    getToken, setToken, clearToken, getUser, setUser,
    get: (p, q) => request(p, { query: q }),
    post: (p, b) => request(p, { method: 'POST', body: b }),
    put: (p, b) => request(p, { method: 'PUT', body: b }),
    del: (p) => request(p, { method: 'DELETE' }),
    request
  };
})();
