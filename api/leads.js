const allowedStatuses = new Set(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);
const allowedPriorities = new Set(['hot', 'warm', 'cold']);

const env = () => ({
  url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  anon: process.env.SUPABASE_ANON_KEY || '',
  service: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
});

function jsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function supabaseRequest(path, options = {}) {
  const { url, service } = env();
  if (!url || !service) throw new Error('Supabase server configuration is missing');
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  return fetch(`${url}/rest/v1/${path}`, { ...options, headers });
}

async function isAuthenticated(req) {
  const { url, anon } = env();
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!url || !anon || !token) return false;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  return response.ok;
}

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from || !to) return { skipped: true };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!response.ok) return { skipped: false, ok: false };
  return { skipped: false, ok: true };
}

async function notifyNewLead(lead, sendConfirmation = true) {
  const notificationEmail = process.env.CRM_NOTIFICATION_EMAIL;
  const safe = {
    name: escapeHtml(lead.name),
    email: escapeHtml(lead.email),
    company: escapeHtml(lead.company),
    website: escapeHtml(lead.website),
    service: escapeHtml(lead.service),
    message: escapeHtml(lead.message || '—')
  };
  const tasks = [];
  if (notificationEmail) {
    tasks.push(sendEmail(notificationEmail, `New GDR lead: ${lead.company}`, `<h2>New Global Digital Ranking lead</h2><p><b>Name:</b> ${safe.name}</p><p><b>Email:</b> ${safe.email}</p><p><b>Company:</b> ${safe.company}</p><p><b>Website:</b> ${safe.website}</p><p><b>Service:</b> ${safe.service}</p><p><b>Message:</b> ${safe.message}</p>`));
  }
  if (sendConfirmation) tasks.push(sendEmail(lead.email, 'We received your growth audit request', `<p>Hi ${safe.name},</p><p>Thanks for reaching out to Global Digital Ranking. We received your request for <b>${safe.service}</b> and will review it shortly.</p><p>We’ll come back with a practical next step—no inflated promises.</p><p>— Global Digital Ranking</p>`));
  await Promise.allSettled(tasks);
}

export default async function handler(req, res) {
  const { service } = env();
  if (!service || !process.env.SUPABASE_URL) {
    return res.status(503).json({ error: 'CRM is not configured yet. Add Supabase environment variables in Vercel.' });
  }

  try {
    if (req.method === 'POST') {
      const body = jsonBody(req);
      const adminRequest = await isAuthenticated(req);
      // Honeypot: silently accept bots without saving a lead.
      if (clean(body.contact_website, 200)) return res.status(200).json({ ok: true });

      const lead = {
        name: clean(body.name, 160),
        email: clean(body.email, 240).toLowerCase(),
        company: clean(body.company, 200),
        website: clean(body.website, 500),
        service: clean(body.service, 160),
        message: clean(body.message, 4000),
        source: clean(body.source || (adminRequest ? 'manual-prospect' : 'website'), 80),
        consent: body.consent === true || body.consent === 'yes' || body.consent === 'on',
        status: adminRequest && allowedStatuses.has(body.status) ? body.status : 'new',
        priority: adminRequest && allowedPriorities.has(body.priority) ? body.priority : 'warm',
        notes: adminRequest ? clean(body.notes, 4000) : '',
        next_follow_up: adminRequest ? (body.next_follow_up || null) : null
      };
      if (!lead.name || !validEmail(lead.email) || !lead.company || !lead.website || !lead.service || (!adminRequest && !lead.consent)) {
        return res.status(400).json({ error: 'Please complete the required fields.' });
      }

      const response = await supabaseRequest('leads', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(lead)
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Could not save the lead.', detail: data });
      const saved = Array.isArray(data) ? data[0] : data;
      await notifyNewLead(saved, lead.consent);
      return res.status(201).json({ ok: true, lead: saved });
    }

    if (!(await isAuthenticated(req))) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.method === 'GET') {
      const response = await supabaseRequest('leads?select=*&order=created_at.desc&limit=500');
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Could not load leads.', detail: data });
      return res.status(200).json({ leads: data });
    }

    if (req.method === 'PATCH') {
      const body = jsonBody(req);
      const id = clean(body.id, 80);
      const patch = {};
      if (body.name !== undefined) patch.name = clean(body.name, 160);
      if (body.email !== undefined && validEmail(clean(body.email, 240))) patch.email = clean(body.email, 240).toLowerCase();
      if (body.company !== undefined) patch.company = clean(body.company, 200);
      if (body.website !== undefined) patch.website = clean(body.website, 500);
      if (body.service !== undefined) patch.service = clean(body.service, 160);
      if (body.status && allowedStatuses.has(body.status)) patch.status = body.status;
      if (body.priority && allowedPriorities.has(body.priority)) patch.priority = body.priority;
      if (body.notes !== undefined) patch.notes = clean(body.notes, 4000);
      if (body.next_follow_up !== undefined) patch.next_follow_up = body.next_follow_up || null;
      if (body.last_contacted_at !== undefined) patch.last_contacted_at = body.last_contacted_at || null;
      if (!id || !Object.keys(patch).length) return res.status(400).json({ error: 'No valid update supplied.' });
      const response = await supabaseRequest(`leads?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Could not update the lead.', detail: data });
      return res.status(200).json({ lead: Array.isArray(data) ? data[0] : data });
    }

    if (req.method === 'DELETE') {
      const id = clean(req.query?.id, 80);
      if (!id) return res.status(400).json({ error: 'Lead id is required.' });
      const response = await supabaseRequest(`leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) return res.status(502).json({ error: 'Could not delete the lead.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unexpected CRM error.' });
  }
}
