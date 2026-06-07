/* =========================================
   UI HELPERS
========================================= */
const UI = (() => {
  const toast = (msg, type = 'info', ms = 3500) => {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ⓘ';
    t.innerHTML = `<span style="font-size:16px;font-weight:600">${icon}</span><span>${escapeHtml(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity 0.2s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, ms);
  };

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const parseDateValue = (s) => {
    if (!s) return null;
    const value = String(s);
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (s) => {
    const d = parseDateValue(s);
    if (!d) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (s) => {
    const d = parseDateValue(s);
    if (!d) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatMoney = (n) => {
    if (n == null) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  };

  const initials = (name) => {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const badge = (text, kind = 'gray') => `<span class="badge badge-${kind}">${escapeHtml(text)}</span>`;

  const confirmDialog = (msg) => Promise.resolve(window.confirm(msg));

  const modal = (title, bodyHtml, { onSave, saveLabel = 'Save', saveClass = 'btn-primary', onCancel, hideFooter = false } = {}) => {
    const root = document.getElementById('modalContainer');
    root.innerHTML = `
      <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(2px);z-index:1000;display:grid;place-items:center;padding:16px;">
        <div class="card" style="width:100%;max-width:640px;max-height:90vh;overflow:auto;box-shadow:var(--shadow-lg)">
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(title)}</div>
            </div>
            <button class="btn btn-ghost btn-icon" data-modal-close>✕</button>
          </div>
          <div class="card-body">${bodyHtml}</div>
          ${hideFooter ? '' : `<div class="card-footer">
            <button class="btn btn-ghost" data-modal-cancel>Cancel</button>
            <button class="btn ${saveClass}" data-modal-save>${escapeHtml(saveLabel)}</button>
          </div>`}
        </div>
      </div>`;
    const close = () => { root.innerHTML = ''; if (onCancel) try { onCancel(); } catch (_) {} };
    root.querySelector('[data-modal-close]').onclick = close;
    root.querySelector('[data-modal-cancel]').onclick = close;
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
    const save = root.querySelector('[data-modal-save]');
    if (save) save.onclick = async () => {
      save.disabled = true;
      const orig = save.innerHTML;
      save.innerHTML = '<span class="spinner"></span>';
      try {
        const ok = await Promise.resolve(onSave ? onSave(root) : true);
        if (ok !== false) close();
      } catch (e) {
        toast(e.message || 'Failed', 'error');
      } finally {
        save.disabled = false;
        save.innerHTML = orig;
      }
    };
    return { close, root };
  };

  const paginate = (page, total, pageSize, onChange) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return `
      <div class="flex items-center justify-between" style="padding:10px 16px;border-top:1px solid var(--border);font-size:12.5px;color:var(--text-muted)">
        <span>Showing ${Math.min(total, (page - 1) * pageSize + 1)}–${Math.min(total, page * pageSize)} of ${total}</span>
        <div class="flex gap-8">
          <button class="btn btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>
          <span style="align-self:center">Page ${page} / ${totalPages}</span>
          <button class="btn btn-sm" data-page="next" ${page >= totalPages ? 'disabled' : ''}>Next ›</button>
        </div>
      </div>`;
  };
  const bindPaginator = (el, onChange) => {
    el.querySelectorAll('[data-page]').forEach(b => b.onclick = () => onChange(b.dataset.page === 'prev' ? -1 : 1));
  };

  return { toast, escapeHtml, formatDate, formatDateTime, formatMoney, initials, badge, confirmDialog, modal, paginate, bindPaginator };
})();
