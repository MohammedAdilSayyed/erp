/* =========================================
   APP CONTROLLER
========================================= */
const App = (() => {
  const state = { user: null };

  // ---------------- ROUTE TABLE ----------------
  const routes = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', roles: ['admin','faculty','student','librarian','accountant'],
      title: 'Dashboard', breadcrumb: '/ Dashboard', run: () => Pages.dashboard() },

    { id: 'my-space', label: 'My Space', icon: '👤', roles: ['student','faculty'], group: 'Personal',
      children: [
        { id: 'profile', label: 'My Profile', icon: '👤', roles: ['admin','faculty','student','librarian','accountant'],
          title: 'My Profile', breadcrumb: '/ My Profile', run: () => Pages.profile() },
        { id: 'my-courses', label: 'My Courses', icon: '📚', roles: ['student'],
          title: 'My Courses', breadcrumb: '/ My Courses', run: () => Pages.myEnrollments() },
        { id: 'my-attendance', label: 'My Attendance', icon: '✓', roles: ['student'],
          title: 'My Attendance', breadcrumb: '/ My Attendance', run: () => Pages.myAttendance() },
        { id: 'my-grades', label: 'My Grades', icon: '📊', roles: ['student'],
          title: 'My Grades', breadcrumb: '/ My Grades', run: () => Pages.myGrades() },
        { id: 'my-payments', label: 'My Payments', icon: '💵', roles: ['student'],
          title: 'My Payments', breadcrumb: '/ My Payments', run: () => Pages.myPayments() }
      ]
    },

    { id: 'academics', label: 'Academics', icon: '🎓', roles: ['admin','faculty','student'], group: 'Academics',
      children: [
        { id: 'students', label: 'Students', icon: '🎓', roles: ['admin','faculty'],
          title: 'Students', breadcrumb: '/ Academics / Students', run: () => Pages.studentsList() },
        { id: 'faculty', label: 'Faculty', icon: '👨‍🏫', roles: ['admin'],
          title: 'Faculty', breadcrumb: '/ Academics / Faculty', run: () => Pages.facultyList() },
        { id: 'departments', label: 'Departments', icon: '🏛', roles: ['admin'],
          title: 'Departments', breadcrumb: '/ Academics / Departments', run: () => Pages.departments() },
        { id: 'courses', label: 'Courses', icon: '📚', roles: ['admin','faculty','student'],
          title: 'Courses', breadcrumb: '/ Academics / Courses', run: () => Pages.coursesList() },
        { id: 'offerings', label: 'Course Offerings', icon: '📅', roles: ['admin','faculty','student'],
          title: 'Course Offerings', breadcrumb: '/ Academics / Offerings', run: () => Pages.offeringsList() }
      ]
    },

    { id: 'teaching', label: 'Teaching', icon: '📝', roles: ['admin','faculty'], group: 'Teaching',
      children: [
        { id: 'attendance', label: 'Attendance', icon: '✓', roles: ['admin','faculty'],
          title: 'Attendance', breadcrumb: '/ Teaching / Attendance', run: () => Pages.attendancePage() },
        { id: 'grades', label: 'Grades', icon: '📊', roles: ['admin','faculty'],
          title: 'Grades', breadcrumb: '/ Teaching / Grades', run: () => Pages.gradesPage() }
      ]
    },

    { id: 'finance', label: 'Finance', icon: '💰', roles: ['admin','accountant','student'], group: 'Operations',
      children: [
        { id: 'fees-structures', label: 'Fee Structures', icon: '📋', roles: ['admin','accountant'],
          title: 'Fee Structures', breadcrumb: '/ Finance / Fee Structures', run: () => Pages.feesStructures() },
        { id: 'fees-payments', label: 'Fee Payments', icon: '💵', roles: ['admin','accountant','student'],
          title: 'Fee Payments', breadcrumb: '/ Finance / Fee Payments', run: () => Pages.feePayments() }
      ]
    },

    { id: 'library', label: 'Library', icon: '📖', roles: ['admin','librarian','faculty','student'], group: 'Operations',
      children: [
        { id: 'library-books', label: 'Books', icon: '📚', roles: ['admin','librarian','faculty','student'],
          title: 'Library — Books', breadcrumb: '/ Library / Books', run: () => Pages.libraryBooks() },
        { id: 'library-issues', label: 'Circulation', icon: '🔄', roles: ['admin','librarian','faculty','student'],
          title: 'Library — Circulation', breadcrumb: '/ Library / Circulation', run: () => Pages.libraryIssues() }
      ]
    },

    { id: 'hostel', label: 'Hostel', icon: '🏠', roles: ['admin'], group: 'Operations',
      children: [
        { id: 'hostel-list', label: 'Hostels', icon: '🏠', roles: ['admin'],
          title: 'Hostels', breadcrumb: '/ Hostel / Hostels', run: () => Pages.hostels() }
      ]
    },

    { id: 'notices', label: 'Notices', icon: '📢', roles: ['admin','faculty','student','librarian','accountant'],
      title: 'Notices', breadcrumb: '/ Notices', run: () => Pages.notices() },

    { id: 'admin', label: 'Administration', icon: '⚙', roles: ['admin'], group: 'Admin',
      children: [
        { id: 'users', label: 'Users', icon: '👥', roles: ['admin'],
          title: 'Users', breadcrumb: '/ Admin / Users', run: () => Pages.users() },
        { id: 'audit', label: 'Audit Logs', icon: '📋', roles: ['admin'],
          title: 'Audit Logs', breadcrumb: '/ Admin / Audit Logs', run: () => Pages.auditLogs() }
      ]
    }
  ];

  // ---------------- FLATTEN ----------------
  const flatten = () => {
    const out = [];
    for (const r of routes) {
      if (r.children) {
        for (const c of r.children) {
          if (c.roles && !c.roles.includes(state.user.role)) continue;
          out.push({ ...c, group: r.group, parentLabel: r.label, parentIcon: r.icon });
        }
      } else {
        if (r.roles && !r.roles.includes(state.user.role)) continue;
        out.push(r);
      }
    }
    return out;
  };

  // ---------------- NAV ----------------
  const renderNav = () => {
    const flat = flatten();
    const nav = document.getElementById('sidebarNav');
    let html = '';
    let lastGroup = null;
    for (const r of flat) {
      const group = r.group || (lastGroup === null ? 'Main' : null);
      if (group && group !== lastGroup) {
        html += `<div class="nav-group-title">${group}</div>`;
        lastGroup = group;
      }
      const active = location.hash === '#/' + r.id ? 'active' : '';
      html += `<button class="nav-link ${active}" data-route="${r.id}">
        <span class="icon">${r.icon || '•'}</span>${r.label}
      </button>`;
    }
    nav.innerHTML = html;
    nav.querySelectorAll('[data-route]').forEach(b => b.onclick = () => navigate(b.dataset.route));
  };

  const findRoute = (id) => flatten().find(r => r.id === id);

  const navigate = (id) => {
    const r = findRoute(id);
    if (!r) { navigate('dashboard'); return; }
    location.hash = '#/' + id;
  };

  // ---------------- HEADER ----------------
  const renderHeader = () => {
    document.getElementById('pageTitle').textContent = '—';
    document.getElementById('pageBreadcrumb').textContent = '—';
    const r = findRoute(currentRouteId());
    if (r) {
      document.getElementById('pageTitle').textContent = r.title || r.label;
      document.getElementById('pageBreadcrumb').textContent = r.breadcrumb || ('/ ' + r.label);
    }
  };

  const currentRouteId = () => {
    const h = location.hash.replace(/^#\//, '');
    return h || 'dashboard';
  };

  // ---------------- ROUTER ----------------
  const handleRoute = () => {
    const id = currentRouteId();
    const r = findRoute(id);
    if (!r) { navigate('dashboard'); return; }
    renderHeader();
    document.querySelectorAll('[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === id));
    try { r.run(); } catch (e) { console.error(e); UI.toast('Page failed to load: ' + e.message, 'error'); }
  };

  // ---------------- LOGIN ----------------
  const showLogin = () => {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    loginView.hidden = false;
    appView.hidden = true;
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
  };

  const showApp = () => {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    loginView.hidden = true;
    appView.hidden = false;
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
  };

  const renderUserChip = () => {
    const u = state.user;
    const p = state.profile || {};
    const name = p.first_name ? p.first_name + ' ' + p.last_name : u.email;
    document.getElementById('userAvatar').textContent = UI.initials(name);
    document.getElementById('userName').textContent = name;
    document.getElementById('userMeta').textContent = u.email;
    document.getElementById('sidebarRole').textContent = u.role;
  };

  const tryRestore = async () => {
    if (!API.getToken()) return false;
    try {
      const { data } = await API.get('/auth/me');
      state.user = data.user; state.profile = data.profile;
      return true;
    } catch (e) {
      API.clearToken();
      return false;
    }
  };

  const start = async () => {
    const restored = await tryRestore();
    if (restored) {
      showApp(); renderNav(); renderHeader(); renderUserChip(); handleRoute();
    } else {
      showLogin();
    }
  };

  const login = async (email, password) => {
    const btn = document.getElementById('loginSubmit');
    const errEl = document.getElementById('loginError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Signing in…</span>';
    try {
      const { data } = await API.post('/auth/login', { email, password });
      API.setToken(data.token);
      API.setUser(data.user);
      state.user = data.user;
      state.profile = data.profile;
      showApp();
      renderNav(); renderHeader(); renderUserChip();
      navigate('dashboard');
      UI.toast('Welcome back!', 'success');
    } catch (e) {
      errEl.textContent = e.message || 'Login failed';
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-label">Sign in</span>';
    }
  };

  const logout = () => {
    API.clearToken();
    state.user = null; state.profile = null;
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    showLogin();
  };

  const openChangePassword = () => {
    const dlg = document.getElementById('changePwdDialog');
    dlg.showModal();
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.newPassword !== body.confirm) {
      document.getElementById('changePwdError').textContent = 'Passwords do not match';
      document.getElementById('changePwdError').hidden = false;
      return;
    }
    delete body.confirm;
    try {
      await API.post('/auth/change-password', body);
      UI.toast('Password changed', 'success');
      e.target.reset();
      document.getElementById('changePwdDialog').close();
      if (state.user) state.user.must_change_password = 0;
    } catch (e) {
      document.getElementById('changePwdError').textContent = e.message;
      document.getElementById('changePwdError').hidden = false;
    }
  };

  const hasRole = (...roles) => state.user && roles.includes(state.user.role);

  // ---------------- BIND ----------------
  const bind = () => {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      login(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
    });
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('userChip').onclick = () => navigate('profile');
    document.getElementById('changePwdForm').addEventListener('submit', submitChangePassword);
    document.getElementById('changePwdCancel').onclick = () => document.getElementById('changePwdDialog').close();

    // Global search
    const gs = document.getElementById('globalSearch');
    gs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = gs.value.trim();
        if (q) navigate('students');
        gs.blur();
      }
    });
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        gs.focus();
      }
    });

    window.addEventListener('hashchange', () => {
      if (!document.getElementById('appView').hidden) handleRoute();
    });
  };

  return { start, bind, navigate, logout, hasRole, openChangePassword, get user() { return state.user; } };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.bind();
  App.start();
});
