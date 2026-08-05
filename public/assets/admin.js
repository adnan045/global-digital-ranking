(() => {
  let config = null;
  let token = sessionStorage.getItem('gdr_crm_token') || '';
  let leads = [];
  let activeLead = null;

  const $ = (selector) => document.querySelector(selector);
  const loginView = $('#login-view');
  const appView = $('#app-view');
  const loginForm = $('#login-form');
  const loginError = $('#login-error');
  const connectionLabel = $('#connection-label');
  const connectionDot = $('#connection-dot');

  const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dateText = (value) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
  const statusLabel = (value) => String(value || 'new').replace(/^./, (letter) => letter.toUpperCase());

  async function getConfig() {
    const response = await fetch('/api/config');
    config = await response.json();
    if (!config.configured) throw new Error('CRM backend is not configured yet.');
  }

  async function login(email, password) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || 'Login failed.');
    token = data.access_token;
    sessionStorage.setItem('gdr_crm_token', token);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { logout(); throw new Error('Your session expired.'); }
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    connectionLabel.textContent = 'Supabase connected';
    connectionDot.classList.add('online');
  }

  function logout() {
    token = '';
    sessionStorage.removeItem('gdr_crm_token');
    appView.hidden = true;
    loginView.hidden = false;
    connectionDot.classList.remove('online');
  }

  function filteredLeads() {
    const query = ($('#search-input')?.value || '').toLowerCase().trim();
    const status = $('#status-filter')?.value || 'all';
    const priority = $('#priority-filter')?.value || 'all';
    return leads.filter((lead) => {
      const haystack = [lead.name, lead.email, lead.company, lead.website, lead.service].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || lead.status === status) && (priority === 'all' || lead.priority === priority);
    });
  }

  function renderStats() {
    const stats = [
      ['Total leads', leads.length],
      ['New', leads.filter((lead) => lead.status === 'new').length],
      ['Hot priority', leads.filter((lead) => lead.priority === 'hot').length],
      ['Won', leads.filter((lead) => lead.status === 'won').length]
    ];
    $('#stat-grid').innerHTML = stats.map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderLeads() {
    const list = $('#lead-list');
    const empty = $('#empty-state');
    const visible = filteredLeads();
    $('#lead-count').textContent = `${visible.length} of ${leads.length} lead${leads.length === 1 ? '' : 's'}`;
    if (!visible.length) { list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    list.innerHTML = visible.map((lead) => `<article class="lead-row" data-id="${esc(lead.id)}">
      <div class="lead-company"><span class="lead-avatar">${esc(initials(lead.company || lead.name))}</span><div><strong>${esc(lead.company || 'Unnamed company')}</strong><small>${esc(lead.name)} · ${esc(lead.service)}</small></div></div>
      <div class="lead-contact"><strong>${esc(lead.email)}</strong><small>${esc(lead.website)}</small></div>
      <div><span class="badge badge-${esc(lead.status)}">${esc(statusLabel(lead.status))}</span></div>
      <div class="priority priority-${esc(lead.priority)}">${esc(lead.priority || 'warm')}</div>
      <div class="lead-date">${esc(dateText(lead.created_at))}</div>
      <button class="row-action" type="button" data-open-lead="${esc(lead.id)}" aria-label="Open lead">↗</button>
    </article>`).join('');
    list.querySelectorAll('[data-open-lead]').forEach((button) => button.addEventListener('click', () => openLead(button.dataset.openLead)));
  }

  function render() { renderStats(); renderLeads(); }

  async function loadLeads() {
    $('#refresh-button').disabled = true;
    $('#lead-count').textContent = 'Loading leads…';
    try { const data = await api('/api/leads'); leads = data.leads || []; render(); }
    catch (error) { $('#lead-count').textContent = error.message; }
    finally { $('#refresh-button').disabled = false; }
  }

  function fillLeadForm(lead = {}) {
    $('#edit-id').value = lead.id || '';
    $('#edit-name').value = lead.name || '';
    $('#edit-email').value = lead.email || '';
    $('#edit-company').value = lead.company || '';
    $('#edit-website').value = lead.website || '';
    $('#edit-service').value = lead.service || 'Website & conversion';
    $('#edit-status').value = lead.status || 'new';
    $('#edit-priority').value = lead.priority || 'warm';
    $('#edit-follow-up').value = lead.next_follow_up || '';
    $('#edit-notes').value = lead.notes || '';
  }

  function openLead(id) {
    activeLead = leads.find((lead) => lead.id === id);
    if (!activeLead) return;
    $('#modal-title').textContent = activeLead.company || 'Lead detail';
    $('#modal-summary').innerHTML = `<div><b>Created:</b> ${esc(dateText(activeLead.created_at))}</div><div><b>Source:</b> ${esc(activeLead.source || 'website')}</div><div><b>Message:</b> ${esc(activeLead.message || '—')}</div>`;
    fillLeadForm(activeLead);
    $('#delete-lead').hidden = false;
    $('#edit-error').textContent = '';
    $('#modal-backdrop').hidden = false;
  }

  function openNewLead() {
    activeLead = null;
    $('#modal-title').textContent = 'Add a prospect';
    $('#modal-summary').innerHTML = '<div>Add a business you found for targeted outreach. It will be saved as a manual prospect and will not receive an automatic confirmation email.</div>';
    fillLeadForm({ status: 'new', priority: 'warm', service: 'Website & conversion' });
    $('#delete-lead').hidden = true;
    $('#edit-error').textContent = '';
    $('#modal-backdrop').hidden = false;
  }

  function closeModal() { $('#modal-backdrop').hidden = true; activeLead = null; }

  async function saveLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const payload = { name: $('#edit-name').value, email: $('#edit-email').value, company: $('#edit-company').value, website: $('#edit-website').value, service: $('#edit-service').value, status: $('#edit-status').value, priority: $('#edit-priority').value, next_follow_up: $('#edit-follow-up').value, notes: $('#edit-notes').value, source: 'manual-prospect' };
    try {
      if (activeLead) {
        const data = await api('/api/leads', { method: 'PATCH', body: JSON.stringify({ id: activeLead.id, ...payload }) });
        const index = leads.findIndex((lead) => lead.id === activeLead.id);
        if (index >= 0) leads[index] = data.lead;
      } else {
        const data = await api('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
        if (data.lead) leads.unshift(data.lead);
      }
      closeModal(); render();
    } catch (error) { $('#edit-error').textContent = error.message; }
    finally { button.disabled = false; }
  }

  async function deleteLead() {
    if (!activeLead || !window.confirm(`Delete the lead from ${activeLead.company}?`)) return;
    try { await api(`/api/leads?id=${encodeURIComponent(activeLead.id)}`, { method: 'DELETE' }); leads = leads.filter((lead) => lead.id !== activeLead.id); closeModal(); render(); }
    catch (error) { $('#edit-error').textContent = error.message; }
  }

  function exportCsv() {
    const rows = filteredLeads();
    const columns = ['created_at', 'name', 'email', 'company', 'website', 'service', 'status', 'priority', 'next_follow_up', 'notes', 'message'];
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `gdr-leads-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); loginError.textContent = '';
    const button = loginForm.querySelector('button'); button.disabled = true; button.textContent = 'Signing in…';
    try { await login($('#login-email').value.trim(), $('#login-password').value); showApp(); await loadLeads(); }
    catch (error) { loginError.textContent = error.message; }
    finally { button.disabled = false; button.innerHTML = 'Open CRM <span>↗</span>'; }
  });
  $('#logout-button').addEventListener('click', logout);
  $('#add-lead-button').addEventListener('click', openNewLead);
  $('#refresh-button').addEventListener('click', loadLeads);
  $('#export-button').addEventListener('click', exportCsv);
  $('#search-input').addEventListener('input', renderLeads);
  $('#status-filter').addEventListener('change', renderLeads);
  $('#priority-filter').addEventListener('change', renderLeads);
  $('#edit-form').addEventListener('submit', saveLead);
  $('#delete-lead').addEventListener('click', deleteLead);
  $('#close-modal').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

  (async () => {
    try {
      await getConfig();
      if (token) { showApp(); await loadLeads(); }
    } catch (error) {
      connectionLabel.textContent = 'Setup required';
      connectionDot.classList.add('offline');
      loginError.textContent = error.message;
    }
  })();
})();
