/* =========================================
   PAGE RENDERERS
========================================= */
const Pages = (() => {

  const setPage = (html) => {
    const el = document.getElementById('pageContent');
    el.innerHTML = html;
    el.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  const wrap = (title, breadcrumb, body, actions = '') => `
    <div class="page-header">
      <div>
        <h1>${title}</h1>
        <p>${breadcrumb}</p>
      </div>
      <div class="page-header-actions">${actions}</div>
    </div>
    ${body}`;

  const empty = (msg, icon = '📭') => `<div class="empty"><div class="empty-icon">${icon}</div>${UI.escapeHtml(msg)}</div>`;

  const loading = () => `<div class="page-loading">Loading…</div>`;

  const err = (e) => `<div class="card"><div class="card-body"><div class="form-error">${UI.escapeHtml(e.message || 'Failed to load')}</div></div></div>`;

  const filterBar = (filters) => `<div class="table-toolbar">${filters}</div>`;

  // =======================================
  // DASHBOARD
  // =======================================
  const dashboard = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/dashboard/stats');
      const { counts, finance, attendanceToday, hostel, charts, recent } = data;
      const maxDept = Math.max(1, ...charts.studentsByDept.map(d => d.c));
      const maxBatch = Math.max(1, ...charts.studentsByBatch.map(d => d.c));

      const html = wrap(
        'Dashboard',
        'Overview of the college at a glance',
        `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon bg-blue">🎓</div>
            <div class="stat-label">Active Students</div>
            <div class="stat-value">${counts.totalStudents.toLocaleString()}</div>
            <div class="stat-foot">${counts.totalEnrollments} active enrollments</div></div>
          <div class="stat-card"><div class="stat-icon bg-purple">👨‍🏫</div>
            <div class="stat-label">Faculty</div>
            <div class="stat-value">${counts.totalFaculty.toLocaleString()}</div>
            <div class="stat-foot">across all departments</div></div>
          <div class="stat-card"><div class="stat-icon bg-cyan">📚</div>
            <div class="stat-label">Courses</div>
            <div class="stat-value">${counts.totalCourses.toLocaleString()}</div>
            <div class="stat-foot">${counts.totalOfferings} active offerings</div></div>
          <div class="stat-card"><div class="stat-icon bg-green">💰</div>
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">${UI.formatMoney(finance.totalRevenue)}</div>
            <div class="stat-foot">${UI.formatMoney(finance.recentPayments)} last 30 days</div></div>
          <div class="stat-card"><div class="stat-icon bg-amber">📖</div>
            <div class="stat-label">Library</div>
            <div class="stat-value">${counts.totalBooks.toLocaleString()}</div>
            <div class="stat-foot">${counts.issuedBooks} books issued</div></div>
          <div class="stat-card"><div class="stat-icon bg-pink">🏠</div>
            <div class="stat-label">Hostel</div>
            <div class="stat-value">${counts.hostels.toLocaleString()}</div>
            <div class="stat-foot">${hostel.occupied} / ${hostel.capacity} beds occupied</div></div>
        </div>

        <div class="charts-grid">
          <div class="card">
            <div class="card-header"><div class="card-title">Students by Department</div></div>
            <div class="card-body">
              <div class="bar-chart">
                ${charts.studentsByDept.map(d => `
                  <div class="bar-row">
                    <div class="label">${UI.escapeHtml(d.name)}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(d.c / maxDept) * 100}%"></div></div>
                    <div class="count">${d.c}</div>
                  </div>`).join('') || empty('No data')}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Students by Batch</div></div>
            <div class="card-body">
              <div class="bar-chart">
                ${charts.studentsByBatch.map(d => `
                  <div class="bar-row">
                    <div class="label">Batch ${d.name}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(d.c / maxBatch) * 100}%;background:linear-gradient(90deg,#16a34a,#0d9488)"></div></div>
                    <div class="count">${d.c}</div>
                  </div>`).join('') || empty('No data')}
              </div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">Today's Attendance</div></div>
            <div class="card-body">
              <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin:0;gap:10px">
                <div class="stat-card" style="padding:12px"><div class="stat-icon bg-green">✓</div>
                  <div class="stat-label">Present</div><div class="stat-value" style="font-size:20px">${attendanceToday.present}</div></div>
                <div class="stat-card" style="padding:12px"><div class="stat-icon bg-red">✕</div>
                  <div class="stat-label">Absent</div><div class="stat-value" style="font-size:20px">${attendanceToday.absent}</div></div>
                <div class="stat-card" style="padding:12px"><div class="stat-icon bg-amber">⏰</div>
                  <div class="stat-label">Late</div><div class="stat-value" style="font-size:20px">${attendanceToday.late}</div></div>
                <div class="stat-card" style="padding:12px"><div class="stat-icon bg-cyan">ⓘ</div>
                  <div class="stat-label">Excused</div><div class="stat-value" style="font-size:20px">${attendanceToday.excused}</div></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Recent Notices</div>
              <a href="#/notices" data-route="notices" class="btn btn-sm btn-ghost">View all →</a>
            </div>
            <div class="card-body">
              ${recent.notices.length ? `<ul class="list">${recent.notices.map(n => `
                <li class="list-item">
                  <span class="icon">📢</span>
                  <div>
                    <div style="font-weight:500">${UI.escapeHtml(n.title)}</div>
                    <div class="muted">${UI.formatDate(n.created_at)}</div>
                  </div>
                  <div class="meta">${UI.badge(n.priority, n.priority === 'urgent' ? 'danger' : n.priority === 'high' ? 'warning' : 'info')}</div>
                </li>`).join('')}</ul>` : empty('No notices yet', '📢')}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Recent Fee Payments</div>
              <a href="#/fees-payments" data-route="fees-payments" class="btn btn-sm btn-ghost">View all →</a>
            </div>
            <div class="card-body">
              ${recent.payments.length ? `<ul class="list">${recent.payments.map(p => `
                <li class="list-item">
                  <span class="icon">💵</span>
                  <div>
                    <div style="font-weight:500">${UI.escapeHtml(p.first_name + ' ' + p.last_name)} <span class="muted">${UI.escapeHtml(p.roll_no)}</span></div>
                    <div class="muted">${UI.formatDateTime(p.paid_at)}</div>
                  </div>
                  <div class="meta" style="font-weight:600">${UI.formatMoney(p.amount)}</div>
                </li>`).join('')}</ul>` : empty('No payments yet', '💵')}
            </div>
          </div>
        </div>`
      );
      setPage(html);
      document.querySelectorAll('[data-route]').forEach(a => a.onclick = (e) => { e.preventDefault(); App.navigate(a.dataset.route); });
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // STUDENTS
  // =======================================
  const studentsList = async (params = {}) => {
    setPage(loading());
    let state = { page: 1, pageSize: 25, q: '', departmentId: '', status: 'active', ...params };

    const render = async () => {
      try {
        const [{ data: depts }, res] = await Promise.all([
          API.get('/departments'),
          API.get('/students', { ...state })
        ]);
        const rows = res.items;
        const html = wrap(
          'Students',
          `Manage enrolled students — ${res.total} total`,
          `<button class="btn btn-primary" data-add>+ Add Student</button>`,
          ''
        ) + `
        <div class="table-wrap">
          <div class="table-toolbar">
            <input id="f-q" placeholder="Search by name, roll, email…" value="${UI.escapeHtml(state.q)}" />
            <select id="f-dept">
              <option value="">All Departments</option>
              ${depts.map(d => `<option value="${d.id}" ${+state.departmentId === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
            </select>
            <select id="f-status">
              ${['active','suspended','graduated','dropout'].map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
            <button class="btn btn-sm" data-search>Search</button>
            <div class="spacer"></div>
            <button class="btn btn-sm btn-ghost" data-reset>Reset</button>
          </div>
          ${rows.length ? `
            <table class="data">
              <thead><tr>
                <th>Roll No</th><th>Name</th><th>Department</th><th>Program</th>
                <th>Semester</th><th>Batch</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>${rows.map(s => `
                <tr>
                  <td><code>${UI.escapeHtml(s.roll_no)}</code></td>
                  <td><div style="font-weight:500">${UI.escapeHtml(s.first_name + ' ' + s.last_name)}</div><div class="muted">${UI.escapeHtml(s.email)}</div></td>
                  <td>${UI.escapeHtml(s.department_name || '—')}</td>
                  <td>${UI.escapeHtml(s.program || '—')}</td>
                  <td>${s.current_semester ?? '—'}</td>
                  <td>${s.batch_year ?? '—'}</td>
                  <td>${UI.badge(s.status, s.status === 'active' ? 'success' : s.status === 'suspended' ? 'warning' : 'gray')}</td>
                  <td class="actions">
                    <button class="btn btn-sm" data-view="${s.id}">View</button>
                    ${App.hasRole('admin') ? `<button class="btn btn-sm btn-danger" data-del="${s.id}">Delete</button>` : ''}
                  </td>
                </tr>`).join('')}</tbody>
            </table>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}
          ` : empty('No students found', '🎓')}
        </div>`;
        setPage(html);
        document.querySelector('[data-add]').onclick = () => studentForm(null, depts, () => render());
        document.querySelector('[data-search]').onclick = () => { state.q = document.getElementById('f-q').value; state.departmentId = document.getElementById('f-dept').value; state.status = document.getElementById('f-status').value; state.page = 1; render(); };
        document.querySelector('[data-reset]').onclick = () => { state = { page: 1, pageSize: 25, q: '', departmentId: '', status: 'active' }; render(); };
        document.getElementById('f-q').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('[data-search]').click(); });
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
        document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => studentDetail(b.dataset.view, depts, () => render()));
        document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!await UI.confirmDialog('Delete this student? This cannot be undone.')) return;
          try { await API.del('/students/' + b.dataset.del); UI.toast('Student deleted', 'success'); render(); }
          catch (e) { UI.toast(e.message, 'error'); }
        });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const studentForm = (existing, depts, reload) => {
    const s = existing || {};
    UI.modal(existing ? 'Edit Student' : 'Add Student', `
      <form class="form-grid" id="studentForm">
        <label><span>Email *</span><input name="email" type="email" required value="${UI.escapeHtml(s.email || '')}" /></label>
        <label><span>Roll No *</span><input name="rollNo" required value="${UI.escapeHtml(s.roll_no || '')}" /></label>
        <label><span>First Name *</span><input name="firstName" required value="${UI.escapeHtml(s.first_name || '')}" /></label>
        <label><span>Last Name *</span><input name="lastName" required value="${UI.escapeHtml(s.last_name || '')}" /></label>
        <label><span>Date of Birth</span><input name="dob" type="date" value="${UI.escapeHtml(s.dob || '')}" /></label>
        <label><span>Gender</span>
          <select name="gender">
            <option value="">—</option>
            ${['Male','Female','Other'].map(g => `<option ${s.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </label>
        <label><span>Phone</span><input name="phone" value="${UI.escapeHtml(s.phone || '')}" /></label>
        <label><span>Address</span><input name="address" value="${UI.escapeHtml(s.address || '')}" /></label>
        <label><span>City</span><input name="city" value="${UI.escapeHtml(s.city || '')}" /></label>
        <label><span>State</span><input name="state" value="${UI.escapeHtml(s.state || '')}" /></label>
        <label><span>Pincode</span><input name="pincode" value="${UI.escapeHtml(s.pincode || '')}" /></label>
        <label><span>Guardian Name</span><input name="guardianName" value="${UI.escapeHtml(s.guardian_name || '')}" /></label>
        <label><span>Guardian Phone</span><input name="guardianPhone" value="${UI.escapeHtml(s.guardian_phone || '')}" /></label>
        <label><span>Department</span>
          <select name="departmentId">
            <option value="">—</option>
            ${depts.map(d => `<option value="${d.id}" ${+s.department_id === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
          </select>
        </label>
        <label><span>Program</span><input name="program" value="${UI.escapeHtml(s.program || '')}" /></label>
        <label><span>Batch Year</span><input name="batchYear" type="number" min="2000" max="2099" value="${s.batch_year || ''}" /></label>
        <label><span>Current Semester</span><input name="currentSemester" type="number" min="1" max="12" value="${s.current_semester || 1}" /></label>
        <label class="full"><span>Status</span>
          <select name="status">
            ${['active','suspended','graduated','dropout'].map(x => `<option ${s.status === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
        </label>
        ${existing ? '' : '<div class="full muted">A temporary password will be generated and shown after save.</div>'}
      </form>`, {
      onSave: async () => {
        const f = document.getElementById('studentForm');
        const fd = new FormData(f);
        const body = Object.fromEntries(fd.entries());
        if (existing) {
          await API.put('/students/' + existing.id, body);
          UI.toast('Student updated', 'success');
        } else {
          const r = await API.post('/students', body);
          UI.toast('Student created — temp password: ' + r.data.tempPassword, 'success', 6000);
        }
        reload();
      }
    });
  };

  const studentDetail = async (id, depts, reload) => {
    setPage(loading());
    try {
      const { data } = await API.get('/students/' + id);
      const s = data;
      const html = wrap(
        s.first_name + ' ' + s.last_name,
        `Roll No: ${s.roll_no} • ${UI.escapeHtml(s.email)}`,
        `<button class="btn" data-back>← Back to list</button>${App.hasRole('admin') ? `<button class="btn btn-primary" data-edit>Edit</button>` : ''}`
      ) + `
        <div class="profile-header">
          <div class="avatar">${UI.initials(s.first_name + ' ' + s.last_name)}</div>
          <div>
            <h2>${UI.escapeHtml(s.first_name + ' ' + s.last_name)}</h2>
            <div class="muted">${UI.escapeHtml(s.email)} • ${UI.badge(s.status, s.status === 'active' ? 'success' : 'gray')}</div>
            <div class="profile-grid">
              <div class="item"><div class="k">Roll No</div><div class="v"><code>${UI.escapeHtml(s.roll_no)}</code></div></div>
              <div class="item"><div class="k">DOB</div><div class="v">${UI.formatDate(s.dob)}</div></div>
              <div class="item"><div class="k">Gender</div><div class="v">${UI.escapeHtml(s.gender || '—')}</div></div>
              <div class="item"><div class="k">Phone</div><div class="v">${UI.escapeHtml(s.phone || '—')}</div></div>
              <div class="item"><div class="k">Department</div><div class="v">${UI.escapeHtml(s.department_name || '—')}</div></div>
              <div class="item"><div class="k">Program</div><div class="v">${UI.escapeHtml(s.program || '—')}</div></div>
              <div class="item"><div class="k">Batch</div><div class="v">${s.batch_year || '—'}</div></div>
              <div class="item"><div class="k">Semester</div><div class="v">${s.current_semester || '—'}</div></div>
              <div class="item"><div class="k">Guardian</div><div class="v">${UI.escapeHtml(s.guardian_name || '—')}</div></div>
              <div class="item"><div class="k">Guardian Phone</div><div class="v">${UI.escapeHtml(s.guardian_phone || '—')}</div></div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">Enrollments</div></div>
            <div class="card-body">
              ${s.enrollments && s.enrollments.length ? `<table class="data"><thead><tr><th>Course</th><th>Term</th><th>Section</th><th>Status</th></tr></thead>
                <tbody>${s.enrollments.map(e => `<tr>
                  <td><strong>${UI.escapeHtml(e.course_code)}</strong> ${UI.escapeHtml(e.course_name)}</td>
                  <td>${UI.escapeHtml(e.term)}</td>
                  <td>${UI.escapeHtml(e.section)}</td>
                  <td>${UI.badge(e.status, e.status === 'enrolled' ? 'success' : 'gray')}</td>
                </tr>`).join('')}</tbody></table>` : empty('No enrollments', '📚')}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Recent Payments</div></div>
            <div class="card-body">
              ${s.payments && s.payments.length ? `<ul class="list">${s.payments.map(p => `
                <li class="list-item">
                  <span class="icon">💵</span>
                  <div>
                    <div style="font-weight:600">${UI.formatMoney(p.amount)}</div>
                    <div class="muted">${UI.escapeHtml(p.receipt_no)} • ${UI.formatDate(p.paid_at)}</div>
                  </div>
                  <div class="meta">${UI.badge(p.status, p.status === 'success' ? 'success' : 'warning')}</div>
                </li>`).join('')}</ul>` : empty('No payments', '💵')}
            </div>
          </div>
        </div>`;
      setPage(html);
      document.querySelector('[data-back]').onclick = () => studentsList();
      const editBtn = document.querySelector('[data-edit]');
      if (editBtn) editBtn.onclick = () => studentForm(s, depts, () => studentDetail(id, depts, reload));
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // FACULTY
  // =======================================
  const facultyList = async () => {
    setPage(loading());
    let state = { page: 1, pageSize: 25, q: '', departmentId: '' };
    const render = async () => {
      try {
        const [{ data: depts }, res] = await Promise.all([
          API.get('/departments'),
          API.get('/faculty', { ...state })
        ]);
        const rows = res.items;
        setPage(`
          <div class="page-header"><div><h1>Faculty</h1><p>${res.total} total</p></div>
            <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ Add Faculty</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <input id="f-q" placeholder="Search by name, employee id, email…" value="${UI.escapeHtml(state.q)}" />
              <select id="f-dept">
                <option value="">All Departments</option>
                ${depts.map(d => `<option value="${d.id}" ${+state.departmentId === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Search</button>
              <div class="spacer"></div>
            </div>
            ${rows.length ? `<table class="data"><thead><tr>
              <th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Phone</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>${rows.map(f => `<tr>
              <td><code>${UI.escapeHtml(f.employee_id)}</code></td>
              <td><div style="font-weight:500">${UI.escapeHtml(f.first_name + ' ' + f.last_name)}</div><div class="muted">${UI.escapeHtml(f.email)}</div></td>
              <td>${UI.escapeHtml(f.department_name || '—')}</td>
              <td>${UI.escapeHtml(f.designation || '—')}</td>
              <td>${UI.escapeHtml(f.phone || '—')}</td>
              <td>${UI.badge(f.status, f.status === 'active' ? 'success' : 'gray')}</td>
              <td class="actions">
                <button class="btn btn-sm" data-view="${f.id}">View</button>
                ${App.hasRole('admin') ? `<button class="btn btn-sm btn-danger" data-del="${f.id}">Delete</button>` : ''}
              </td>
            </tr>`).join('')}</tbody></table>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}` : empty('No faculty', '👨‍🏫')}
          </div>`);
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => facultyForm(null, depts, render);
        document.querySelector('[data-search]').onclick = () => { state.q = document.getElementById('f-q').value; state.departmentId = document.getElementById('f-dept').value; state.page = 1; render(); };
        document.getElementById('f-q').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('[data-search]').click(); });
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
        document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => facultyDetail(b.dataset.view, depts, render));
        document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!await UI.confirmDialog('Delete this faculty member?')) return;
          try { await API.del('/faculty/' + b.dataset.del); UI.toast('Faculty deleted', 'success'); render(); }
          catch (e) { UI.toast(e.message, 'error'); }
        });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const facultyForm = (existing, depts, reload) => {
    const f = existing || {};
    UI.modal(existing ? 'Edit Faculty' : 'Add Faculty', `
      <form class="form-grid" id="facForm">
        <label><span>Email *</span><input name="email" type="email" required value="${UI.escapeHtml(f.email || '')}" /></label>
        <label><span>Employee ID *</span><input name="employeeId" required value="${UI.escapeHtml(f.employee_id || '')}" ${existing ? 'disabled' : ''} /></label>
        <label><span>First Name *</span><input name="firstName" required value="${UI.escapeHtml(f.first_name || '')}" /></label>
        <label><span>Last Name *</span><input name="lastName" required value="${UI.escapeHtml(f.last_name || '')}" /></label>
        <label><span>Phone</span><input name="phone" value="${UI.escapeHtml(f.phone || '')}" /></label>
        <label><span>Designation</span><input name="designation" value="${UI.escapeHtml(f.designation || '')}" /></label>
        <label><span>Qualification</span><input name="qualification" value="${UI.escapeHtml(f.qualification || '')}" /></label>
        <label><span>Department</span>
          <select name="departmentId">
            <option value="">—</option>
            ${depts.map(d => `<option value="${d.id}" ${+f.department_id === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
          </select>
        </label>
        ${existing ? `<label class="full"><span>Status</span>
          <select name="status">
            ${['active','on_leave','retired','terminated'].map(x => `<option ${f.status === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select></label>` : ''}
        ${existing ? '' : '<div class="full muted">A temporary password will be generated and shown after save.</div>'}
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('facForm'));
        const body = Object.fromEntries(fd.entries());
        if (existing) {
          await API.put('/faculty/' + existing.id, body);
          UI.toast('Faculty updated', 'success');
        } else {
          const r = await API.post('/faculty', body);
          UI.toast('Faculty created — temp password: ' + r.data.tempPassword, 'success', 6000);
        }
        reload();
      }
    });
  };

  const facultyDetail = async (id, depts, reload) => {
    setPage(loading());
    try {
      const { data } = await API.get('/faculty/' + id);
      const f = data;
      setPage(`
        <div class="page-header"><div><h1>${UI.escapeHtml(f.first_name + ' ' + f.last_name)}</h1>
          <p>${UI.escapeHtml(f.email)}</p></div>
          <div class="page-header-actions"><button class="btn" data-back>← Back</button>${App.hasRole('admin') ? '<button class="btn btn-primary" data-edit>Edit</button>' : ''}</div></div>
        <div class="profile-header">
          <div class="avatar">${UI.initials(f.first_name + ' ' + f.last_name)}</div>
          <div>
            <h2>${UI.escapeHtml(f.first_name + ' ' + f.last_name)}</h2>
            <div class="muted">${UI.badge(f.status, f.status === 'active' ? 'success' : 'gray')}</div>
            <div class="profile-grid">
              <div class="item"><div class="k">Employee ID</div><div class="v"><code>${UI.escapeHtml(f.employee_id)}</code></div></div>
              <div class="item"><div class="k">Phone</div><div class="v">${UI.escapeHtml(f.phone || '—')}</div></div>
              <div class="item"><div class="k">Designation</div><div class="v">${UI.escapeHtml(f.designation || '—')}</div></div>
              <div class="item"><div class="k">Qualification</div><div class="v">${UI.escapeHtml(f.qualification || '—')}</div></div>
              <div class="item"><div class="k">Department</div><div class="v">${UI.escapeHtml(f.department_name || '—')}</div></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Current Offerings</div></div>
          <div class="card-body">
            ${f.offerings && f.offerings.length ? `<table class="data"><thead><tr><th>Course</th><th>Term</th><th>Section</th></tr></thead>
              <tbody>${f.offerings.map(o => `<tr><td><strong>${UI.escapeHtml(o.code)}</strong> ${UI.escapeHtml(o.name)}</td>
              <td>${UI.escapeHtml(o.term)}</td><td>${UI.escapeHtml(o.section)}</td></tr>`).join('')}</tbody></table>` : empty('No current offerings', '📚')}
          </div>
        </div>`);
      document.querySelector('[data-back]').onclick = facultyList;
      const edit = document.querySelector('[data-edit]');
      if (edit) edit.onclick = () => facultyForm(f, depts, () => facultyDetail(id, depts, reload));
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // COURSES
  // =======================================
  const coursesList = async () => {
    setPage(loading());
    let state = { q: '', departmentId: '', semester: '' };
    const render = async () => {
      try {
        const [{ data: depts }, { data: courses }] = await Promise.all([
          API.get('/departments'),
          API.get('/courses', state)
        ]);
        setPage(`
          <div class="page-header"><div><h1>Courses</h1><p>${courses.length} courses</p></div>
            <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ Add Course</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <input id="f-q" placeholder="Search by code or name…" value="${UI.escapeHtml(state.q)}" />
              <select id="f-dept">
                <option value="">All Departments</option>
                ${depts.map(d => `<option value="${d.id}" ${+state.departmentId === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
              </select>
              <select id="f-sem">
                <option value="">All Semesters</option>
                ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${+state.semester === s ? 'selected' : ''}>Sem ${s}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Search</button>
            </div>
            ${courses.length ? `<table class="data"><thead><tr>
              <th>Code</th><th>Name</th><th>Department</th><th>Credits</th><th>Semester</th><th>Type</th>
            </tr></thead>
            <tbody>${courses.map(c => `<tr>
              <td><code>${UI.escapeHtml(c.code)}</code></td>
              <td><div style="font-weight:500">${UI.escapeHtml(c.name)}</div><div class="muted">${UI.escapeHtml(c.description || '').slice(0, 100)}</div></td>
              <td>${UI.escapeHtml(c.department_name || '—')}</td>
              <td>${c.credits}</td>
              <td>${c.semester || '—'}</td>
              <td>${UI.badge(c.is_elective ? 'Elective' : 'Core', c.is_elective ? 'purple' : 'info')}</td>
            </tr>`).join('')}</tbody></table>` : empty('No courses', '📚')}
          </div>`);
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => courseForm(null, depts, render);
        document.querySelector('[data-search]').onclick = () => { state.q = document.getElementById('f-q').value; state.departmentId = document.getElementById('f-dept').value; state.semester = document.getElementById('f-sem').value; render(); };
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const courseForm = (existing, depts, reload) => {
    const c = existing || {};
    UI.modal(existing ? 'Edit Course' : 'Add Course', `
      <form class="form-grid" id="courseForm">
        <label><span>Code *</span><input name="code" required value="${UI.escapeHtml(c.code || '')}" ${existing ? 'disabled' : ''} /></label>
        <label><span>Credits *</span><input name="credits" type="number" min="1" max="10" required value="${c.credits || 3}" /></label>
        <label class="full"><span>Name *</span><input name="name" required value="${UI.escapeHtml(c.name || '')}" /></label>
        <label class="full"><span>Description</span><textarea name="description">${UI.escapeHtml(c.description || '')}</textarea></label>
        <label><span>Department</span>
          <select name="departmentId">
            <option value="">—</option>
            ${depts.map(d => `<option value="${d.id}" ${+c.department_id === d.id ? 'selected' : ''}>${UI.escapeHtml(d.name)}</option>`).join('')}
          </select>
        </label>
        <label><span>Semester</span>
          <select name="semester">
            <option value="">—</option>
            ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${+c.semester === s ? 'selected' : ''}>Sem ${s}</option>`).join('')}
          </select>
        </label>
        <label><span>Program</span><input name="program" value="${UI.escapeHtml(c.program || '')}" /></label>
        <label class="full"><span><input type="checkbox" name="isElective" ${c.is_elective ? 'checked' : ''} /> Elective course</span></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('courseForm'));
        const body = Object.fromEntries(fd.entries());
        body.isElective = !!fd.get('isElective');
        if (existing) {
          await API.put('/courses/' + existing.id, body);
          UI.toast('Course updated', 'success');
        } else {
          await API.post('/courses', body);
          UI.toast('Course created', 'success');
        }
        reload();
      }
    });
  };

  // =======================================
  // OFFERINGS
  // =======================================
  const offeringsList = async () => {
    setPage(loading());
    let state = { term: '' };
    const render = async () => {
      try {
        const [{ data: courses }, { data: faculty }, { data: offerings }] = await Promise.all([
          API.get('/courses'),
          API.get('/faculty', { pageSize: 200 }),
          API.get('/offerings', state)
        ]);
        setPage(`
          <div class="page-header"><div><h1>Course Offerings</h1><p>${offerings.length} offerings</p></div>
            <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ Add Offering</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <select id="f-term">
                <option value="">All Terms</option>
                ${[...new Set(offerings.map(o => o.term))].map(t => `<option value="${t}" ${state.term === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Filter</button>
            </div>
            ${offerings.length ? `<table class="data"><thead><tr>
              <th>Course</th><th>Faculty</th><th>Section</th><th>Term</th><th>Room</th><th>Schedule</th><th>Enrollment</th>
            </tr></thead>
            <tbody>${offerings.map(o => `<tr>
              <td><div style="font-weight:500"><code>${UI.escapeHtml(o.course_code)}</code> ${UI.escapeHtml(o.course_name)}</div><div class="muted">${o.credits} credits</div></td>
              <td>${UI.escapeHtml(o.faculty_name || '—')}</td>
              <td>${UI.escapeHtml(o.section)}</td>
              <td>${UI.escapeHtml(o.term)}</td>
              <td>${UI.escapeHtml(o.room || '—')}</td>
              <td><div class="muted" style="font-size:12px;max-width:240px">${UI.escapeHtml(o.schedule || '—')}</div></td>
              <td><div style="display:flex;align-items:center;gap:6px"><strong>${o.enrolled_count}</strong><span class="muted">/ ${o.capacity}</span></div></td>
            </tr>`).join('')}</tbody></table>` : empty('No offerings', '📅')}
          </div>`);
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => offeringForm(null, courses, faculty, render);
        document.querySelector('[data-search]').onclick = () => { state.term = document.getElementById('f-term').value; render(); };
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const offeringForm = (existing, courses, faculty, reload) => {
    const o = existing || {};
    UI.modal(existing ? 'Edit Offering' : 'Add Offering', `
      <form class="form-grid" id="offForm">
        <label class="full"><span>Course *</span>
          <select name="courseId" required ${existing ? 'disabled' : ''}>
            ${courses.map(c => `<option value="${c.id}" ${+o.course_id === c.id ? 'selected' : ''}>${UI.escapeHtml(c.code + ' — ' + c.name)}</option>`).join('')}
          </select>
        </label>
        <label><span>Faculty *</span>
          <select name="facultyId" required>
            <option value="">—</option>
            ${faculty.items.map(f => `<option value="${f.id}" ${+o.faculty_id === f.id ? 'selected' : ''}>${UI.escapeHtml(f.first_name + ' ' + f.last_name + ' (' + f.employee_id + ')')}</option>`).join('')}
          </select>
        </label>
        <label><span>Section</span><input name="section" value="${UI.escapeHtml(o.section || 'A')}" /></label>
        <label><span>Term *</span><input name="term" required value="${UI.escapeHtml(o.term || '2026-Spring')}" ${existing ? 'disabled' : ''} /></label>
        <label><span>Academic Year *</span><input name="academicYear" required value="${UI.escapeHtml(o.academic_year || '2025-2026')}" ${existing ? 'disabled' : ''} /></label>
        <label><span>Capacity</span><input name="capacity" type="number" min="1" max="500" value="${o.capacity || 60}" /></label>
        <label><span>Room</span><input name="room" value="${UI.escapeHtml(o.room || '')}" /></label>
        <label class="full"><span>Schedule</span><input name="schedule" value="${UI.escapeHtml(o.schedule || '')}" placeholder="Mon 09:00-10:30, Wed 09:00-10:30" /></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('offForm'));
        const body = Object.fromEntries(fd.entries());
        if (existing) {
          await API.put('/offerings/' + existing.id, body);
          UI.toast('Offering updated', 'success');
        } else {
          await API.post('/offerings', body);
          UI.toast('Offering created', 'success');
        }
        reload();
      }
    });
  };

  // =======================================
  // ATTENDANCE (Faculty)
  // =======================================
  const attendancePage = async () => {
    if (!App.hasRole('faculty', 'admin')) return UI.toast('Faculty or admin only', 'error');
    setPage(loading());
    try {
      const { data: offerings } = await API.get('/offerings', App.hasRole('faculty') ? {} : {});
      let filtered = offerings;
      if (App.hasRole('faculty')) {
        const { data: mine } = await API.get('/my/offerings');
        filtered = mine;
      }
      setPage(`
        <div class="page-header"><div><h1>Attendance</h1><p>Mark attendance for your offerings</p></div></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Select an offering</div></div>
          <div class="card-body">
            ${filtered.length ? `<ul class="list">${filtered.map(o => `<li class="list-item" style="cursor:pointer" data-off="${o.id}">
              <span class="icon">📅</span>
              <div>
                <div style="font-weight:600">${UI.escapeHtml(o.code)} — ${UI.escapeHtml(o.name)}</div>
                <div class="muted">${UI.escapeHtml(o.term)} • Section ${UI.escapeHtml(o.section)} • ${o.schedule || '—'}</div>
              </div>
              <div class="meta">${o.enrolled_count} enrolled →</div>
            </li>`).join('')}</ul>` : empty('No offerings assigned', '📅')}
          </div>
        </div>`);
      document.querySelectorAll('[data-off]').forEach(b => b.onclick = () => markAttendance(+b.dataset.off));
    } catch (e) { setPage(err(e)); }
  };

  const markAttendance = async (offeringId) => {
    setPage(loading());
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [{ data: roster }, { data: existing }] = await Promise.all([
        API.get('/offerings/' + offeringId + '/roster'),
        API.get('/attendance/offering/' + offeringId, { sessionDate: today })
      ]);
      const existingMap = new Map(existing.map(a => [a.enrollment_id, a.status]));
      setPage(`
        <div class="page-header"><div><h1>Mark Attendance</h1>
          <p>${UI.formatDate(today)}</p></div>
          <div class="page-header-actions"><button class="btn" data-back>← Back</button>
            <button class="btn btn-success" data-save>Save</button>
          </div></div>
        <div class="card">
          <div class="card-body" style="padding:0">
            <table class="data">
              <thead><tr><th>Roll No</th><th>Name</th><th>Status</th><th>Remarks</th></tr></thead>
              <tbody>${roster.map(r => {
                const cur = existingMap.get(r.enrollment_id) || 'present';
                return `<tr data-enr="${r.enrollment_id}">
                  <td><code>${UI.escapeHtml(r.roll_no)}</code></td>
                  <td>${UI.escapeHtml(r.first_name + ' ' + r.last_name)}</td>
                  <td>
                    <select data-field="status" data-student="${r.student_id}">
                      ${['present','absent','late','excused'].map(s => `<option value="${s}" ${cur === s ? 'selected' : ''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}
                    </select>
                  </td>
                  <td><input data-field="remarks" data-student="${r.student_id}" placeholder="Optional" style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;font:inherit;font-size:12.5px" /></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>`);
      document.querySelector('[data-back]').onclick = attendancePage;
      document.querySelector('[data-save]').onclick = async () => {
        const records = [];
        document.querySelectorAll('select[data-field="status"]').forEach(sel => {
          const studentId = +sel.dataset.student;
          const remarks = document.querySelector(`input[data-field="remarks"][data-student="${studentId}"]`)?.value || '';
          records.push({ studentId, status: sel.value, remarks });
        });
        try {
          await API.post('/attendance/mark', { offeringId, sessionDate: today, records });
          UI.toast('Attendance saved', 'success');
        } catch (e) { UI.toast(e.message, 'error'); }
      };
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // GRADES (Faculty)
  // =======================================
  const gradesPage = async () => {
    if (!App.hasRole('faculty', 'admin')) return UI.toast('Faculty or admin only', 'error');
    setPage(loading());
    try {
      const { data: offerings } = await API.get('/my/offerings');
      setPage(`
        <div class="page-header"><div><h1>Grades</h1><p>Manage assessments and grades</p></div></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Select an offering</div></div>
          <div class="card-body">
            ${offerings.length ? `<ul class="list">${offerings.map(o => `<li class="list-item" style="cursor:pointer" data-off="${o.id}">
              <span class="icon">📊</span>
              <div>
                <div style="font-weight:600">${UI.escapeHtml(o.code)} — ${UI.escapeHtml(o.name)}</div>
                <div class="muted">${UI.escapeHtml(o.term)} • Section ${UI.escapeHtml(o.section)}</div>
              </div>
              <div class="meta">${o.enrolled_count} enrolled →</div>
            </li>`).join('')}</ul>` : empty('No offerings assigned', '📊')}
          </div>
        </div>`);
      document.querySelectorAll('[data-off]').forEach(b => b.onclick = () => gradeEntry(+b.dataset.off));
    } catch (e) { setPage(err(e)); }
  };

  const gradeEntry = async (offeringId) => {
    setPage(loading());
    try {
      const [{ data: assessments }, { data: students }, { data: summary }] = await Promise.all([
        API.get('/assessments/offering/' + offeringId),
        API.get('/grades/offering/' + offeringId).then(r => ({ data: r.data.students })),
        API.get('/attendance/summary/offering/' + offeringId)
      ]);
      const attMap = new Map(summary.map(s => [s.student_id, s]));

      setPage(`
        <div class="page-header"><div><h1>Grade Entry</h1><p>${students.length} students enrolled</p></div>
          <div class="page-header-actions">
            <button class="btn" data-back>← Back</button>
            <button class="btn btn-primary" data-add>+ Add Assessment</button>
          </div></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Assessments</div></div>
          <div class="card-body" style="padding:0">
            ${assessments.length ? `<table class="data"><thead><tr><th>Name</th><th>Type</th><th>Max</th><th>Weight</th><th>Due</th><th></th></tr></thead>
              <tbody>${assessments.map(a => `<tr>
                <td>${UI.escapeHtml(a.name)}</td>
                <td>${UI.badge(a.type, 'info')}</td>
                <td>${a.max_marks}</td>
                <td>${(a.weight * 100).toFixed(0)}%</td>
                <td>${UI.formatDate(a.due_date)}</td>
                <td class="actions"><button class="btn btn-sm btn-primary" data-grade="${a.id}">Enter Grades</button></td>
              </tr>`).join('')}</tbody></table>` : empty('No assessments yet', '📝')}
          </div>
        </div>
        <div class="card mt-16">
          <div class="card-header"><div class="card-title">Student Summary</div></div>
          <div class="card-body" style="padding:0">
            <table class="data"><thead><tr><th>Roll</th><th>Name</th><th>Attendance</th>
              ${assessments.map(a => `<th>${UI.escapeHtml(a.name)}</th>`).join('')}
              <th>Final</th><th>Grade</th>
            </tr></thead>
            <tbody>${students.map(s => {
              const att = attMap.get(s.student_id);
              return `<tr>
                <td><code>${UI.escapeHtml(s.roll_no)}</code></td>
                <td>${UI.escapeHtml(s.first_name + ' ' + s.last_name)}</td>
                <td>${att ? `${att.pct}%` : '—'}</td>
                ${assessments.map(a => {
                  const p = s.perAssessment[a.id];
                  return `<td>${p && p.marksObtained != null ? `<strong>${p.marksObtained}</strong><span class="muted">/${a.max_marks}</span>` : '<span class="muted">—</span>'}</td>`;
                }).join('')}
                <td><strong>${s.finalPct.toFixed(1)}%</strong></td>
                <td>${UI.badge(s.finalGrade, s.finalGrade === 'F' ? 'danger' : 'success')}</td>
              </tr>`;
            }).join('')}</tbody></table>
          </div>
        </div>`);
      document.querySelector('[data-back]').onclick = gradesPage;
      document.querySelector('[data-add]').onclick = () => assessmentForm(offeringId, null, () => gradeEntry(offeringId));
      document.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => enterGrades(+b.dataset.grade, offeringId));
    } catch (e) { setPage(err(e)); }
  };

  const assessmentForm = (offeringId, existing, reload) => {
    const a = existing || {};
    UI.modal(existing ? 'Edit Assessment' : 'Add Assessment', `
      <form class="form-grid" id="aForm">
        <label class="full"><span>Name *</span><input name="name" required value="${UI.escapeHtml(a.name || '')}" /></label>
        <label><span>Type *</span>
          <select name="type" required>
            ${['quiz','assignment','midterm','final','project','lab'].map(t => `<option ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label><span>Max Marks *</span><input name="maxMarks" type="number" min="1" required value="${a.max_marks || 100}" /></label>
        <label><span>Weight (0-1) *</span><input name="weight" type="number" min="0" max="1" step="0.05" required value="${a.weight || 0.1}" /></label>
        <label><span>Due Date</span><input name="dueDate" type="date" value="${UI.escapeHtml(a.due_date || '')}" /></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('aForm'));
        const body = Object.fromEntries(fd.entries());
        body.maxMarks = +body.maxMarks; body.weight = +body.weight;
        if (existing) {
          await API.put('/assessments/' + existing.id, body);
          UI.toast('Assessment updated', 'success');
        } else {
          await API.post('/assessments', { ...body, offeringId });
          UI.toast('Assessment created', 'success');
        }
        reload();
      }
    });
  };

  const enterGrades = async (assessmentId, offeringId) => {
    setPage(loading());
    try {
      const [{ data: students }, { data: assessments }] = await Promise.all([
        API.get('/grades/offering/' + offeringId).then(r => ({ data: r.data.students })),
        API.get('/assessments/offering/' + offeringId)
      ]);
      const a = assessments.find(x => x.id === assessmentId);
      setPage(`
        <div class="page-header"><div><h1>Enter Grades — ${UI.escapeHtml(a.name)}</h1>
          <p>Max: ${a.max_marks} • Weight: ${(a.weight * 100).toFixed(0)}%</p></div>
          <div class="page-header-actions">
            <button class="btn" data-back>← Back</button>
            <button class="btn btn-success" data-save>Save</button>
          </div></div>
        <div class="card">
          <div class="card-body" style="padding:0">
            <table class="data">
              <thead><tr><th>Roll</th><th>Name</th><th>Marks</th><th>Remarks</th></tr></thead>
              <tbody>${students.map(s => {
                const cur = s.perAssessment[assessmentId];
                return `<tr data-enr="${s.enrollment_id}">
                  <td><code>${UI.escapeHtml(s.roll_no)}</code></td>
                  <td>${UI.escapeHtml(s.first_name + ' ' + s.last_name)}</td>
                  <td><input data-field="marks" data-enr="${s.enrollment_id}" type="number" min="0" max="${a.max_marks}" step="0.5" value="${cur && cur.marksObtained != null ? cur.marksObtained : ''}" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:4px" /></td>
                  <td><input data-field="remarks" data-enr="${s.enrollment_id}" value="${UI.escapeHtml(cur?.remarks || '')}" style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;font:inherit;font-size:12.5px" /></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>`);
      document.querySelector('[data-back]').onclick = () => gradeEntry(offeringId);
      document.querySelector('[data-save]').onclick = async () => {
        const records = [];
        document.querySelectorAll('input[data-field="marks"]').forEach(i => {
          const enrollmentId = +i.dataset.enr;
          const remarks = document.querySelector(`input[data-field="remarks"][data-enr="${enrollmentId}"]`)?.value || '';
          if (i.value !== '') records.push({ enrollmentId, marksObtained: +i.value, remarks });
        });
        try {
          await API.post('/grades', { assessmentId, records });
          UI.toast(`${records.length} grades saved`, 'success');
          gradeEntry(offeringId);
        } catch (e) { UI.toast(e.message, 'error'); }
      };
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // MY GRADES (Student)
  // =======================================
  const myGrades = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/auth/me');
      if (data.user.role !== 'student' || !data.profile) return setPage(empty('Student profile not found', '🎓'));
      const { data: grades } = await API.get('/grades/student/' + data.profile.id);
      setPage(`
        <div class="page-header"><div><h1>My Grades</h1>
          <p>CGPA: <strong>${grades.cgpa}</strong> • ${grades.totalCredits} credits</p></div></div>
        ${grades.courses.length ? `<div class="card">
          <div class="card-body" style="padding:0">
            <table class="data"><thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Term</th><th>%</th><th>Grade</th><th>GPA</th></tr></thead>
              <tbody>${grades.courses.map(c => `<tr>
                <td><code>${UI.escapeHtml(c.code)}</code></td>
                <td>${UI.escapeHtml(c.name)}</td>
                <td>${c.credits}</td>
                <td>${UI.escapeHtml(c.term)}</td>
                <td>${(c.pct || 0).toFixed(1)}%</td>
                <td>${UI.badge(c.grade, c.grade === 'F' ? 'danger' : 'success')}</td>
                <td>${c.gpa}</td>
              </tr>`).join('')}</tbody></table>
          </div>
        </div>` : empty('No courses yet', '📚')}`);
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // MY ENROLLMENTS (Student)
  // =======================================
  const myEnrollments = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/my/enrollments');
      setPage(`
        <div class="page-header"><div><h1>My Courses</h1>
          <p>${data.length} active enrollments</p></div></div>
        ${data.length ? `<div class="card">
          <div class="card-body" style="padding:0">
            <table class="data"><thead><tr><th>Code</th><th>Course</th><th>Faculty</th><th>Section</th><th>Term</th><th>Schedule</th><th>Room</th></tr></thead>
              <tbody>${data.map(e => `<tr>
                <td><code>${UI.escapeHtml(e.code)}</code></td>
                <td><div style="font-weight:500">${UI.escapeHtml(e.name)}</div><div class="muted">${e.credits} credits</div></td>
                <td>${UI.escapeHtml(e.faculty_name || '—')}</td>
                <td>${UI.escapeHtml(e.section)}</td>
                <td>${UI.escapeHtml(e.term)}</td>
                <td class="muted" style="font-size:12px">${UI.escapeHtml(e.schedule || '—')}</td>
                <td>${UI.escapeHtml(e.room || '—')}</td>
              </tr>`).join('')}</tbody></table>
          </div>
        </div>` : empty('No enrollments yet', '📚')}`);
    } catch (e) { setPage(err(e)); }
  };

  const myAttendance = async () => {
    setPage(loading());
    try {
      const { data: me } = await API.get('/auth/me');
      if (me.user.role !== 'student' || !me.profile) return setPage(empty('Student profile not found', '🎓'));
      const { data: rows } = await API.get('/attendance/student/' + me.profile.id);
      setPage(`
        <div class="page-header"><div><h1>My Attendance</h1>
          <p>${rows.length} sessions recorded</p></div></div>
        ${rows.length ? `<div class="card">
          <div class="card-body" style="padding:0">
            <table class="data"><thead><tr><th>Date</th><th>Course</th><th>Status</th><th>Remarks</th></tr></thead>
              <tbody>${rows.map(r => `<tr>
                <td>${UI.formatDate(r.session_date)}</td>
                <td><code>${UI.escapeHtml(r.course_code)}</code> ${UI.escapeHtml(r.course_name)}</td>
                <td>${UI.badge(r.status, r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : r.status === 'absent' ? 'danger' : 'info')}</td>
                <td class="muted">${UI.escapeHtml(r.remarks || '—')}</td>
              </tr>`).join('')}</tbody></table>
          </div>
        </div>` : empty('No attendance records yet', '📅')}`);
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // FEES
  // =======================================
  const feesStructures = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/fee-structures');
      setPage(`
        <div class="page-header"><div><h1>Fee Structures</h1>
          <p>${data.length} structures</p></div>
          <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ New Structure</button>' : ''}</div></div>
        <div class="table-wrap">
          ${data.length ? `<table class="data"><thead><tr>
            <th>Name</th><th>Program</th><th>Batch</th><th>Sem</th>
            <th>Tuition</th><th>Lab</th><th>Library</th><th>Hostel</th><th>Exam</th><th>Misc</th>
            <th>Total</th><th>Due</th>
          </tr></thead>
          <tbody>${data.map(f => `<tr>
            <td><strong>${UI.escapeHtml(f.name)}</strong></td>
            <td>${UI.escapeHtml(f.program || '—')}</td>
            <td>${f.batch_year || '—'}</td>
            <td>${f.semester || '—'}</td>
            <td>${UI.formatMoney(f.tuition_fee)}</td>
            <td>${UI.formatMoney(f.lab_fee)}</td>
            <td>${UI.formatMoney(f.library_fee)}</td>
            <td>${UI.formatMoney(f.hostel_fee)}</td>
            <td>${UI.formatMoney(f.exam_fee)}</td>
            <td>${UI.formatMoney(f.misc_fee)}</td>
            <td><strong>${UI.formatMoney(f.total)}</strong></td>
            <td>${UI.formatDate(f.due_date)}</td>
          </tr>`).join('')}</tbody></table>` : empty('No fee structures', '💰')}
        </div>`);
      const add = document.querySelector('[data-add]');
      if (add) add.onclick = () => feeStructureForm(null, () => feesStructures());
    } catch (e) { setPage(err(e)); }
  };

  const feeStructureForm = (existing, reload) => {
    const f = existing || {};
    UI.modal(existing ? 'Edit Fee Structure' : 'New Fee Structure', `
      <form class="form-grid" id="fsForm">
        <label class="full"><span>Name *</span><input name="name" required value="${UI.escapeHtml(f.name || '')}" /></label>
        <label><span>Program</span><input name="program" value="${UI.escapeHtml(f.program || '')}" /></label>
        <label><span>Batch Year</span><input name="batchYear" type="number" min="2000" value="${f.batch_year || ''}" /></label>
        <label><span>Semester</span><input name="semester" type="number" min="1" max="12" value="${f.semester || ''}" /></label>
        <label><span>Tuition</span><input name="tuitionFee" type="number" min="0" value="${f.tuition_fee || 0}" /></label>
        <label><span>Lab</span><input name="labFee" type="number" min="0" value="${f.lab_fee || 0}" /></label>
        <label><span>Library</span><input name="libraryFee" type="number" min="0" value="${f.library_fee || 0}" /></label>
        <label><span>Hostel</span><input name="hostelFee" type="number" min="0" value="${f.hostel_fee || 0}" /></label>
        <label><span>Exam</span><input name="examFee" type="number" min="0" value="${f.exam_fee || 0}" /></label>
        <label><span>Misc</span><input name="miscFee" type="number" min="0" value="${f.misc_fee || 0}" /></label>
        <label class="full"><span>Due Date</span><input name="dueDate" type="date" value="${UI.escapeHtml(f.due_date || '')}" /></label>
      </form>`, {
      onSave: async () => {
        const body = Object.fromEntries(new FormData(document.getElementById('fsForm')).entries());
        Object.keys(body).forEach(k => { if (['tuitionFee','labFee','libraryFee','hostelFee','examFee','miscFee','batchYear','semester'].includes(k)) body[k] = +body[k] || 0; });
        if (existing) {
          await API.put('/fee-structures/' + existing.id, body);
          UI.toast('Updated', 'success');
        } else {
          await API.post('/fee-structures', body);
          UI.toast('Created', 'success');
        }
        reload();
      }
    });
  };

  const feePayments = async () => {
    setPage(loading());
    let state = { page: 1, pageSize: 25, status: '' };
    const render = async () => {
      try {
        const res = await API.get('/payments', state);
        const rows = res.items;
        setPage(`
          <div class="page-header"><div><h1>Fee Payments</h1>
            <p>${res.total} total payments</p></div>
            <div class="page-header-actions">${App.hasRole('admin','accountant') ? '<button class="btn btn-primary" data-add>+ Record Payment</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <select id="f-status">
                <option value="">All Status</option>
                ${['success','pending','failed','refunded'].map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Filter</button>
            </div>
            ${rows.length ? `<table class="data"><thead><tr>
              <th>Receipt</th><th>Student</th><th>Amount</th><th>Mode</th><th>Status</th><th>Paid At</th><th>Txn ID</th><th></th>
            </tr></thead>
            <tbody>${rows.map(p => `<tr>
              <td><code>${UI.escapeHtml(p.receipt_no)}</code></td>
              <td>${UI.escapeHtml(p.first_name + ' ' + p.last_name)} <span class="muted">${UI.escapeHtml(p.roll_no)}</span></td>
              <td><strong>${UI.formatMoney(p.amount)}</strong></td>
              <td>${UI.badge(p.payment_mode, 'info')}</td>
              <td>${UI.badge(p.status, p.status === 'success' ? 'success' : p.status === 'pending' ? 'warning' : 'danger')}</td>
              <td>${UI.formatDateTime(p.paid_at)}</td>
              <td class="muted">${UI.escapeHtml(p.transaction_id || '—')}</td>
              <td class="actions"><button class="btn btn-sm" data-receipt="${p.id}">View</button></td>
            </tr>`).join('')}</tbody></table>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}` : empty('No payments', '💵')}
          </div>`);
        document.querySelector('[data-search]').onclick = () => { state.status = document.getElementById('f-status').value; state.page = 1; render(); };
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => recordPaymentForm(null, render);
        document.querySelectorAll('[data-receipt]').forEach(b => b.onclick = () => viewReceipt(+b.dataset.receipt));
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const recordPaymentForm = (existing, reload) => {
    UI.modal('Record Fee Payment', `
      <form class="form-grid" id="payForm">
        <label class="full"><span>Student</span>
          <select name="studentId" required>
            <option value="">—</option>
          </select>
        </label>
        <label><span>Amount *</span><input name="amount" type="number" min="0" step="0.01" required /></label>
        <label><span>Mode *</span>
          <select name="paymentMode" required>
            ${['cash','card','upi','bank','online','cheque'].map(m => `<option>${m}</option>`).join('')}
          </select>
        </label>
        <label><span>Transaction ID</span><input name="transactionId" /></label>
        <label><span>Structure</span>
          <select name="structureId">
            <option value="">—</option>
          </select>
        </label>
        <label class="full"><span>Remarks</span><input name="remarks" /></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('payForm'));
        const body = Object.fromEntries(fd.entries());
        body.amount = +body.amount;
        const r = await API.post('/payments', body);
        UI.toast('Payment recorded — Receipt: ' + r.data.receipt_no, 'success', 6000);
        reload();
      }
    });
    // populate students + structures
    API.get('/students', { pageSize: 200 }).then(({ data: stu, total }) => {
      const sel = document.querySelector('#payForm select[name=studentId]');
      sel.innerHTML = '<option value="">—</option>' + stu.items.map(s => `<option value="${s.id}">${UI.escapeHtml(s.roll_no + ' — ' + s.first_name + ' ' + s.last_name)}</option>`).join('');
    });
    API.get('/fee-structures').then(({ data }) => {
      const sel = document.querySelector('#payForm select[name=structureId]');
      sel.innerHTML = '<option value="">—</option>' + data.map(f => `<option value="${f.id}">${UI.escapeHtml(f.name)} — ${UI.formatMoney(f.total)}</option>`).join('');
    });
  };

  const viewReceipt = async (id) => {
    setPage(loading());
    try {
      const { data: p } = await API.get('/payments/receipt/' + id);
      const { data: summary } = await API.get('/fees/student/' + p.student_id + '/summary');
      setPage(`
        <div class="page-header"><div><h1>Payment Receipt</h1>
          <p>${UI.escapeHtml(p.receipt_no)}</p></div>
          <div class="page-header-actions"><button class="btn" data-back>← Back</button>
            <button class="btn btn-primary" onclick="window.print()">🖨 Print</button>
          </div></div>
        <div class="card" style="max-width:680px;margin:0 auto">
          <div class="card-body">
            <div style="text-align:center;border-bottom:2px solid var(--border);padding-bottom:16px;margin-bottom:20px">
              <div style="font-size:24px;font-weight:700">🎓 College ERP</div>
              <div class="muted">Fee Payment Receipt</div>
            </div>
            <div class="profile-grid">
              <div class="item"><div class="k">Receipt No</div><div class="v"><code>${UI.escapeHtml(p.receipt_no)}</code></div></div>
              <div class="item"><div class="k">Date</div><div class="v">${UI.formatDateTime(p.paid_at)}</div></div>
              <div class="item"><div class="k">Student</div><div class="v">${UI.escapeHtml(p.first_name + ' ' + p.last_name)}</div></div>
              <div class="item"><div class="k">Roll No</div><div class="v"><code>${UI.escapeHtml(p.roll_no)}</code></div></div>
              <div class="item"><div class="k">Email</div><div class="v">${UI.escapeHtml(p.email)}</div></div>
              <div class="item"><div class="k">Program</div><div class="v">${UI.escapeHtml(p.program || '—')}</div></div>
              <div class="item"><div class="k">Amount</div><div class="v" style="font-size:20px;color:var(--primary)"><strong>${UI.formatMoney(p.amount)}</strong></div></div>
              <div class="item"><div class="k">Mode</div><div class="v">${UI.escapeHtml(p.payment_mode)}</div></div>
              <div class="item"><div class="k">Status</div><div class="v">${UI.badge(p.status, p.status === 'success' ? 'success' : 'warning')}</div></div>
              <div class="item"><div class="k">Transaction ID</div><div class="v">${UI.escapeHtml(p.transaction_id || '—')}</div></div>
            </div>
            <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--border)">
              <div class="muted">Total paid by this student: <strong>${UI.formatMoney(summary.totalPaid)}</strong></div>
            </div>
            <div style="text-align:center;margin-top:24px;font-size:11px;color:var(--text-muted)">
              This is a computer-generated receipt. No signature required.
            </div>
          </div>
        </div>`);
      document.querySelector('[data-back]').onclick = feePayments;
    } catch (e) { setPage(err(e)); }
  };

  const myPayments = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/my/payments');
      setPage(`
        <div class="page-header"><div><h1>My Payments</h1><p>${data.length} payments</p></div></div>
        ${data.length ? `<div class="card"><div class="card-body" style="padding:0">
          <table class="data"><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th><th>Mode</th><th>Status</th><th>Remarks</th><th></th></tr></thead>
            <tbody>${data.map(p => `<tr>
              <td><code>${UI.escapeHtml(p.receipt_no)}</code></td>
              <td>${UI.formatDateTime(p.paid_at)}</td>
              <td><strong>${UI.formatMoney(p.amount)}</strong></td>
              <td>${UI.badge(p.payment_mode, 'info')}</td>
              <td>${UI.badge(p.status, p.status === 'success' ? 'success' : 'warning')}</td>
              <td class="muted">${UI.escapeHtml(p.remarks || '—')}</td>
              <td class="actions"><button class="btn btn-sm" data-receipt="${p.id}">View</button></td>
            </tr>`).join('')}</tbody></table>
        </div></div>` : empty('No payments yet', '💵')}`);
      document.querySelectorAll('[data-receipt]').forEach(b => b.onclick = () => viewReceipt(+b.dataset.receipt));
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // LIBRARY
  // =======================================
  const libraryBooks = async () => {
    setPage(loading());
    let state = { page: 1, pageSize: 25, q: '', category: '' };
    const render = async () => {
      try {
        const res = await API.get('/books', state);
        setPage(`
          <div class="page-header"><div><h1>Library — Books</h1>
            <p>${res.total} titles</p></div>
            <div class="page-header-actions">${App.hasRole('admin','librarian') ? '<button class="btn btn-primary" data-add>+ Add Book</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <input id="f-q" placeholder="Search title/author/ISBN…" value="${UI.escapeHtml(state.q)}" />
              <input id="f-cat" placeholder="Category" value="${UI.escapeHtml(state.category)}" />
              <button class="btn btn-sm" data-search>Search</button>
            </div>
            ${res.items.length ? `<table class="data"><thead><tr>
              <th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Shelf</th>
              <th>Available</th><th>Total</th>
            </tr></thead>
            <tbody>${res.items.map(b => `<tr>
              <td><div style="font-weight:500">${UI.escapeHtml(b.title)}</div><div class="muted">${UI.escapeHtml(b.publisher || '')} ${b.edition ? '· ' + UI.escapeHtml(b.edition) : ''}</div></td>
              <td>${UI.escapeHtml(b.author)}</td>
              <td><code>${UI.escapeHtml(b.isbn || '—')}</code></td>
              <td>${UI.badge(b.category || 'General', 'info')}</td>
              <td>${UI.escapeHtml(b.shelf_location || '—')}</td>
              <td><strong>${b.available_copies}</strong></td>
              <td>${b.total_copies}</td>
            </tr>`).join('')}</tbody></table>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}` : empty('No books', '📚')}
          </div>`);
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => bookForm(null, render);
        document.querySelector('[data-search]').onclick = () => { state.q = document.getElementById('f-q').value; state.category = document.getElementById('f-cat').value; state.page = 1; render(); };
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const bookForm = (existing, reload) => {
    const b = existing || {};
    UI.modal(existing ? 'Edit Book' : 'Add Book', `
      <form class="form-grid" id="bkForm">
        <label class="full"><span>Title *</span><input name="title" required value="${UI.escapeHtml(b.title || '')}" /></label>
        <label class="full"><span>Author *</span><input name="author" required value="${UI.escapeHtml(b.author || '')}" /></label>
        <label><span>ISBN</span><input name="isbn" value="${UI.escapeHtml(b.isbn || '')}" /></label>
        <label><span>Edition</span><input name="edition" value="${UI.escapeHtml(b.edition || '')}" /></label>
        <label><span>Publisher</span><input name="publisher" value="${UI.escapeHtml(b.publisher || '')}" /></label>
        <label><span>Category</span><input name="category" value="${UI.escapeHtml(b.category || '')}" /></label>
        <label><span>Total Copies</span><input name="totalCopies" type="number" min="1" value="${b.total_copies || 1}" /></label>
        <label><span>Shelf</span><input name="shelfLocation" value="${UI.escapeHtml(b.shelf_location || '')}" /></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('bkForm'));
        const body = Object.fromEntries(fd.entries());
        body.totalCopies = +body.totalCopies || 1;
        if (existing) { await API.put('/books/' + existing.id, body); UI.toast('Book updated', 'success'); }
        else { await API.post('/books', body); UI.toast('Book added', 'success'); }
        reload();
      }
    });
  };

  const libraryIssues = async () => {
    setPage(loading());
    let state = { page: 1, pageSize: 25, status: '' };
    const render = async () => {
      try {
        const res = await API.get('/issues', state);
        setPage(`
          <div class="page-header"><div><h1>Library — Circulation</h1>
            <p>${res.total} records</p></div>
            <div class="page-header-actions">${App.hasRole('admin','librarian') ? '<button class="btn btn-primary" data-issue>+ Issue Book</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <select id="f-status">
                <option value="">All Status</option>
                ${['issued','returned','overdue','lost'].map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Filter</button>
            </div>
            ${res.items.length ? `<table class="data"><thead><tr>
              <th>Book</th><th>Borrower</th><th>Issued</th><th>Due</th><th>Returned</th><th>Fine</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>${res.items.map(i => `<tr>
              <td><div style="font-weight:500">${UI.escapeHtml(i.title)}</div><div class="muted">${UI.escapeHtml(i.author)}</div></td>
              <td><div style="font-weight:500">${UI.escapeHtml(i.email)}</div><div class="muted">${UI.badge(i.role, 'gray')}</div></td>
              <td>${UI.formatDate(i.issued_at)}</td>
              <td>${UI.formatDate(i.due_date)}</td>
              <td>${i.returned_at ? UI.formatDate(i.returned_at) : '—'}</td>
              <td>${UI.formatMoney(i.fine_amount)}</td>
              <td>${UI.badge(i.status, i.status === 'returned' ? 'success' : i.status === 'overdue' ? 'danger' : 'info')}</td>
              <td class="actions">${i.status === 'issued' && App.hasRole('admin','librarian') ? `<button class="btn btn-sm btn-success" data-return="${i.id}">Return</button>` : ''}</td>
            </tr>`).join('')}</tbody></table>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}` : empty('No issues', '📖')}
          </div>`);
        document.querySelector('[data-search]').onclick = () => { state.status = document.getElementById('f-status').value; state.page = 1; render(); };
        const issue = document.querySelector('[data-issue]');
        if (issue) issue.onclick = () => issueForm(render);
        document.querySelectorAll('[data-return]').forEach(b => b.onclick = async () => {
          try { const r = await API.post('/issues/' + b.dataset.return + '/return', {}); UI.toast('Returned' + (r.data.fine_amount > 0 ? ' — Fine: ' + UI.formatMoney(r.data.fine_amount) : ''), 'success'); render(); }
          catch (e) { UI.toast(e.message, 'error'); }
        });
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const issueForm = (reload) => {
    UI.modal('Issue Book', `
      <form class="form-grid" id="isForm">
        <label class="full"><span>Book *</span>
          <select name="bookId" required>
            <option value="">—</option>
          </select>
        </label>
        <label><span>Borrower *</span>
          <select name="userId" required>
            <option value="">—</option>
          </select>
        </label>
        <label><span>Days</span><input name="days" type="number" min="1" max="60" value="14" /></label>
      </form>`, {
      onSave: async () => {
        const fd = new FormData(document.getElementById('isForm'));
        const body = Object.fromEntries(fd.entries());
        body.bookId = +body.bookId; body.userId = +body.userId; body.days = +body.days || 14;
        await API.post('/issues', body);
        UI.toast('Book issued', 'success');
        reload();
      }
    });
    API.get('/books', { pageSize: 200 }).then(({ data: bks }) => {
      const sel = document.querySelector('#isForm select[name=bookId]');
      sel.innerHTML = '<option value="">—</option>' + bks.items.filter(b => b.available_copies > 0).map(b => `<option value="${b.id}">${UI.escapeHtml(b.title)} (${b.available_copies} available)</option>`).join('');
    });
    API.get('/users').then(({ data: users }) => {
      const sel = document.querySelector('#isForm select[name=userId]');
      sel.innerHTML = '<option value="">—</option>' + users.filter(u => ['student','faculty'].includes(u.role) && u.is_active).map(u => `<option value="${u.id}">${UI.escapeHtml(u.email)} (${u.role})</option>`).join('');
    });
  };

  // =======================================
  // HOSTEL
  // =======================================
  const hostels = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/hostels');
      setPage(`
        <div class="page-header"><div><h1>Hostels</h1><p>${data.length} hostels</p></div></div>
        <div class="stats-grid">
          ${data.map(h => {
            const pct = h.total_capacity > 0 ? Math.round((h.total_occupied / h.total_capacity) * 100) : 0;
            return `<div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">${UI.escapeHtml(h.name)}</div>
                  <div class="card-subtitle">${UI.badge(h.type, h.type === 'boys' ? 'info' : 'pink')} • Warden: ${UI.escapeHtml(h.warden || '—')}</div>
                </div>
                <div class="card-actions">
                  ${App.hasRole('admin') ? `<button class="btn btn-sm" data-alloc="${h.id}">+ Allocate</button>` : ''}
                </div>
              </div>
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-muted);margin-bottom:6px">
                  <span>${h.total_occupied} / ${h.total_capacity} occupied</span>
                  <strong>${pct}%</strong>
                </div>
                <div class="bar-track" style="height:8px"><div class="bar-fill" style="width:${pct}%"></div></div>
                <div class="muted mt-8" style="font-size:12px">${h.room_count} rooms</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Allocations</div></div>
          <div class="card-body" style="padding:0">
            <div id="allocHostel"></div>
          </div>
        </div>`);
      API.get('/allocations').then(({ data: allocs }) => {
        document.getElementById('allocHostel').innerHTML = allocs.length ? `<table class="data"><thead><tr>
          <th>Student</th><th>Hostel</th><th>Room</th><th>Allocated</th><th>Status</th>
        </tr></thead>
        <tbody>${allocs.map(a => `<tr>
          <td>${UI.escapeHtml(a.first_name + ' ' + a.last_name)} <span class="muted">${UI.escapeHtml(a.roll_no)}</span></td>
          <td>${UI.escapeHtml(a.hostel_name)} ${UI.badge(a.hostel_type, a.hostel_type === 'boys' ? 'info' : 'pink')}</td>
          <td><code>${UI.escapeHtml(a.room_no)}</code></td>
          <td>${UI.formatDate(a.allocated_at)}</td>
          <td>${UI.badge(a.status, a.status === 'active' ? 'success' : 'gray')}</td>
        </tr>`).join('')}</tbody></table>` : empty('No allocations yet', '🏠');
      });
      document.querySelectorAll('[data-alloc]').forEach(b => b.onclick = () => allocateForm(+b.dataset.alloc, hostels));
    } catch (e) { setPage(err(e)); }
  };

  const allocateForm = async (hostelId, reload) => {
    try {
      const { data: rooms } = await API.get('/hostels/' + hostelId + '/rooms');
      UI.modal('Allocate Room', `
        <form class="form-grid" id="aForm">
          <label class="full"><span>Student *</span>
            <select name="studentId" required>
              <option value="">—</option>
            </select>
          </label>
          <label class="full"><span>Room *</span>
            <select name="roomId" required>
              <option value="">—</option>
              ${rooms.filter(r => r.available > 0).map(r => `<option value="${r.id}">${UI.escapeHtml(r.room_no)} — ${r.occupied}/${r.capacity}</option>`).join('')}
            </select>
          </label>
        </form>`, {
        onSave: async () => {
          const body = Object.fromEntries(new FormData(document.getElementById('aForm')).entries());
          body.studentId = +body.studentId; body.roomId = +body.roomId;
          await API.post('/allocations', body);
          UI.toast('Allocated', 'success');
          reload();
        }
      });
      const { data: stu } = await API.get('/students', { pageSize: 200 });
      const sel = document.querySelector('#aForm select[name=studentId]');
      sel.innerHTML = '<option value="">—</option>' + stu.items.map(s => `<option value="${s.id}">${UI.escapeHtml(s.roll_no + ' — ' + s.first_name + ' ' + s.last_name)}</option>`).join('');
    } catch (e) { UI.toast(e.message, 'error'); }
  };

  // =======================================
  // NOTICES
  // =======================================
  const notices = async () => {
    setPage(loading());
    let state = { page: 1, pageSize: 20, audience: '', priority: '' };
    const render = async () => {
      try {
        const res = await API.get('/notices', state);
        setPage(`
          <div class="page-header"><div><h1>Notices</h1><p>${res.total} active notices</p></div>
            <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ New Notice</button>' : ''}</div></div>
          <div class="table-wrap">
            <div class="table-toolbar">
              <select id="f-aud">
                <option value="">All Audience</option>
                ${['all','students','faculty','staff'].map(s => `<option value="${s}" ${state.audience === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <select id="f-pri">
                <option value="">All Priority</option>
                ${['urgent','high','normal','low'].map(s => `<option value="${s}" ${state.priority === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn-sm" data-search>Filter</button>
            </div>
            ${res.items.length ? `<div style="padding:8px 0">${res.items.map(n => `
              <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
                  ${UI.badge(n.priority, n.priority === 'urgent' ? 'danger' : n.priority === 'high' ? 'warning' : n.priority === 'normal' ? 'info' : 'gray')}
                  ${UI.badge(n.audience, 'purple')}
                  <span class="muted" style="font-size:12px;margin-left:auto">${UI.formatDateTime(n.created_at)}</span>
                </div>
                <div style="font-weight:600;font-size:15px">${UI.escapeHtml(n.title)}</div>
                <div class="muted" style="margin-top:4px;white-space:pre-wrap">${UI.escapeHtml(n.body)}</div>
                ${App.hasRole('admin') ? `<div style="margin-top:8px"><button class="btn btn-sm btn-danger" data-del="${n.id}">Delete</button></div>` : ''}
              </div>`).join('')}</div>
            ${UI.paginate(res.page, res.total, res.pageSize, (d) => { state.page = Math.max(1, state.page + d); render(); })}` : empty('No notices', '📢')}
          </div>`);
        document.querySelector('[data-search]').onclick = () => { state.audience = document.getElementById('f-aud').value; state.priority = document.getElementById('f-pri').value; state.page = 1; render(); };
        const add = document.querySelector('[data-add]');
        if (add) add.onclick = () => noticeForm(render);
        document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!await UI.confirmDialog('Delete this notice?')) return;
          try { await API.del('/notices/' + b.dataset.del); UI.toast('Deleted', 'success'); render(); }
          catch (e) { UI.toast(e.message, 'error'); }
        });
        const pag = document.querySelector('[data-page]');
        if (pag) UI.bindPaginator(pag.parentElement.parentElement, (d) => { state.page = Math.max(1, state.page + d); render(); });
      } catch (e) { setPage(err(e)); }
    };
    render();
  };

  const noticeForm = (reload) => {
    UI.modal('New Notice', `
      <form class="form-grid" id="nForm">
        <label class="full"><span>Title *</span><input name="title" required /></label>
        <label class="full"><span>Body *</span><textarea name="body" required style="min-height:140px"></textarea></label>
        <label><span>Audience</span>
          <select name="audience">
            ${['all','students','faculty','staff'].map(s => `<option>${s}</option>`).join('')}
          </select>
        </label>
        <label><span>Priority</span>
          <select name="priority">
            ${['low','normal','high','urgent'].map(s => `<option ${s === 'normal' ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="full"><span>Expires At (optional)</span><input name="expiresAt" type="date" /></label>
      </form>`, {
      onSave: async () => {
        const body = Object.fromEntries(new FormData(document.getElementById('nForm')).entries());
        await API.post('/notices', body);
        UI.toast('Notice posted', 'success');
        reload();
      }
    });
  };

  // =======================================
  // DEPARTMENTS
  // =======================================
  const departments = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/departments');
      setPage(`
        <div class="page-header"><div><h1>Departments</h1><p>${data.length} departments</p></div>
          <div class="page-header-actions">${App.hasRole('admin') ? '<button class="btn btn-primary" data-add>+ Add Department</button>' : ''}</div></div>
        <div class="table-wrap">
          ${data.length ? `<table class="data"><thead><tr><th>Code</th><th>Name</th><th>Head</th></tr></thead>
            <tbody>${data.map(d => `<tr>
              <td><code>${UI.escapeHtml(d.code)}</code></td>
              <td>${UI.escapeHtml(d.name)}</td>
              <td>${UI.escapeHtml(d.head || '—')}</td>
            </tr>`).join('')}</tbody></table>` : empty('No departments', '🏛')}
        </div>`);
      const add = document.querySelector('[data-add]');
      if (add) add.onclick = () => UI.modal('Add Department', `
        <form class="form-grid" id="dForm">
          <label><span>Code *</span><input name="code" required /></label>
          <label><span>Head</span><input name="head" /></label>
          <label class="full"><span>Name *</span><input name="name" required /></label>
        </form>`, {
        onSave: async () => {
          await API.post('/departments', Object.fromEntries(new FormData(document.getElementById('dForm')).entries()));
          UI.toast('Created', 'success'); departments();
        }
      });
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // USERS (admin)
  // =======================================
  const users = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/users');
      setPage(`
        <div class="page-header"><div><h1>Users</h1><p>${data.length} accounts</p></div></div>
        <div class="table-wrap">
          <table class="data"><thead><tr>
            <th>Email</th><th>Role</th><th>Active</th><th>Last Login</th><th>Created</th><th></th>
          </tr></thead>
          <tbody>${data.map(u => `<tr>
            <td><code>${UI.escapeHtml(u.email)}</code></td>
            <td>${UI.badge(u.role, u.role === 'admin' ? 'purple' : u.role === 'faculty' ? 'info' : u.role === 'student' ? 'success' : 'gray')}</td>
            <td>${UI.badge(u.is_active ? 'Active' : 'Inactive', u.is_active ? 'success' : 'gray')}</td>
            <td class="muted">${u.last_login_at ? UI.formatDateTime(u.last_login_at) : 'Never'}</td>
            <td class="muted">${UI.formatDate(u.created_at)}</td>
            <td class="actions">
              <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" data-toggle="${u.id}" data-state="${u.is_active}">${u.is_active ? 'Disable' : 'Enable'}</button>
            </td>
          </tr>`).join('')}</tbody></table>
        </div>`);
      document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
        try { await API.put('/users/' + b.dataset.toggle + '/status', { isActive: +b.dataset.state === 0 }); UI.toast('Updated', 'success'); users(); }
        catch (e) { UI.toast(e.message, 'error'); }
      });
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // AUDIT LOGS
  // =======================================
  const auditLogs = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/dashboard/audit-logs', { page: 1, pageSize: 100 });
      setPage(`
        <div class="page-header"><div><h1>Audit Logs</h1><p>${data.total} total events</p></div></div>
        <div class="table-wrap">
          <table class="data"><thead><tr>
            <th>When</th><th>User</th><th>Role</th><th>Action</th><th>Resource</th><th>IP</th><th>Details</th>
          </tr></thead>
          <tbody>${data.items.map(l => `<tr>
            <td class="muted">${UI.formatDateTime(l.created_at)}</td>
            <td>${UI.escapeHtml(l.email || '—')}</td>
            <td>${l.role ? UI.badge(l.role, 'gray') : '—'}</td>
            <td><code>${UI.escapeHtml(l.action)}</code></td>
            <td class="muted">${UI.escapeHtml(l.resource || '—')}</td>
            <td class="muted">${UI.escapeHtml(l.ip_address || '—')}</td>
            <td class="muted" style="font-size:11.5px;max-width:300px;overflow:hidden;text-overflow:ellipsis">${UI.escapeHtml(l.details || '—')}</td>
          </tr>`).join('')}</tbody></table>
        </div>`);
    } catch (e) { setPage(err(e)); }
  };

  // =======================================
  // PROFILE
  // =======================================
  const profile = async () => {
    setPage(loading());
    try {
      const { data } = await API.get('/auth/me');
      const u = data.user; const p = data.profile || {};
      const fullName = p.first_name ? p.first_name + ' ' + p.last_name : u.email;
      setPage(`
        <div class="page-header"><div><h1>My Profile</h1><p>Account details</p></div></div>
        <div class="profile-header">
          <div class="avatar">${UI.initials(fullName)}</div>
          <div>
            <h2>${UI.escapeHtml(fullName)}</h2>
            <div class="muted">${UI.escapeHtml(u.email)} • ${UI.badge(u.role, 'purple')}</div>
            ${u.must_change_password ? '<div class="form-error mt-8">You must change your password before using the system.</div>' : ''}
            <div style="margin-top:12px">
              <button class="btn btn-primary" data-chpwd>Change Password</button>
            </div>
          </div>
        </div>
        ${Object.keys(p).length ? `<div class="card"><div class="card-header"><div class="card-title">Profile Information</div></div>
          <div class="card-body"><div class="profile-grid">
            ${Object.entries(p).filter(([k]) => !['user_id','created_at','photo_url'].includes(k)).map(([k, v]) => `
              <div class="item"><div class="k">${k.replace(/_/g, ' ')}</div><div class="v">${UI.escapeHtml(String(v ?? '—'))}</div></div>
            `).join('')}
          </div></div></div>` : ''}`);
      document.querySelector('[data-chpwd]').onclick = () => App.openChangePassword();
    } catch (e) { setPage(err(e)); }
  };

  return {
    dashboard, studentsList, facultyList, coursesList, offeringsList,
    attendancePage, gradesPage, myGrades, myEnrollments, myAttendance,
    feesStructures, feePayments, myPayments,
    libraryBooks, libraryIssues, hostels, notices, departments, users, auditLogs, profile
  };
})();
