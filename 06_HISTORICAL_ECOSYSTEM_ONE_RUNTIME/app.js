const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[character]));

const LOCAL_RUNS_KEY = 'genevieve-app-ecosystem-one-runs-v126-vercel';
let pendingHealth = null;
let pendingApprovalEndpoint = '/api/pilot/health/approve-and-run';
let refreshInProgress = false;

const pageTitles = {
  overview: 'Command overview',
  journeys: 'Governed journeys',
  governance: 'Governance controls',
  audit: 'Audit evidence'
};

const serviceCards = {
  main: $('#service-main'),
  health: $('#service-health'),
  animal: $('#service-animal'),
  bridge: $('#service-bridge')
};

const contextCards = {
  tenant: $('#context-tenant'),
  user: $('#context-user'),
  consent: $('#context-consent'),
  approval: $('#context-approval'),
  rejected: $('#context-rejected'),
  audit: $('#context-audit'),
  closure: $('#context-closure')
};

function localRuns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_RUNS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberRun(run) {
  if (!run?.id) return;
  const runs = [run, ...localRuns().filter((item) => item?.id !== run.id)].slice(0, 30);
  localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(runs));
}

function mergeRuns(remoteRuns = []) {
  const all = [...localRuns(), ...(Array.isArray(remoteRuns) ? remoteRuns : [])];
  const unique = new Map();
  for (const run of all) if (run?.id && !unique.has(run.id)) unique.set(run.id, run);
  return [...unique.values()].sort((a, b) => String(b.finishedAt || b.startedAt || '').localeCompare(String(a.finishedAt || a.startedAt || ''));
}

function changeView(view) {
  $$('[data-view-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#page-title').textContent = pageTitles[view] || 'Command overview';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
$$('[data-go-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.goView)));

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${data.error?.code || response.status}: ${data.error?.message || 'Request failed'}`);
  }
  return data;
}

function serviceDetail(key, data) {
  if (data?.error?.message) return data.error.message;
  const version = data?.version ? `V${data.version}` : '';
  const labels = {
    main: 'Authority, identity and queue controls responding',
    health: 'Protected Health branch responding',
    animal: 'Protected Animal branch responding',
    bridge: 'Signed controlled Bridge responding'
  };
  return [labels[key], version].filter(Boolean).join(' · ');
}

function setServiceCard(key, data) {
  const card = serviceCards[key];
  const online = Boolean(data?.ok);
  card.classList.remove('checking', 'online', 'offline');
  card.classList.add(online ? 'online' : 'offline');
  card.querySelector('.state-pill').textContent = online ? 'ONLINE' : 'OFFLINE';
  card.querySelector('.service-detail').textContent = serviceDetail(key, data);
  return online;
}

function setPlainContext(card, value, detail) {
  if (!card) return;
  card.querySelector('.context-value').textContent = value;
  card.querySelector('.context-detail').textContent = detail;
}

function setGovernedContext(card, state, value, detail) {
  if (!card) return;
  card.classList.remove('checking', 'online', 'offline');
  const isOnline = ['valid', 'active', 'approved', 'authorised', 'none', 'clear'].includes(state);
  const isChecking = state === 'checking';
  card.classList.add(isChecking ? 'checking' : isOnline ? 'online' : 'offline');
  const stateLabel = isChecking ? 'CHECKING' : isOnline ? 'VALID' : String(state || 'UNAVAILABLE').toUpperCase();
  card.querySelector('.context-state').textContent = stateLabel;
  card.querySelector('.context-value').textContent = value;
  card.querySelector('.context-detail').textContent = detail;
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

function renderGovernance(governance = {}) {
  const tenant = governance.tenant;
  setPlainContext(
    contextCards.tenant,
    tenant?.name || 'No active tenant',
    tenant ? `${tenant.slug} · ${tenant.status || 'status unavailable'} · ${(tenant.allowedRealms || []).join(', ') || 'no realms'}` : 'Tenant context unavailable'
  );

  const user = governance.user;
  const roles = user?.roles || [];
  setPlainContext(
    contextCards.user,
    user?.displayName || 'No signed-in identity',
    user ? `${roles.join(', ') || 'No role'} · ${user.email || 'No email'}` : 'Identity context unavailable'
  );

  const consent = governance.consent || {};
  setGovernedContext(
    contextCards.consent,
    consent.state || 'unavailable',
    consent.state === 'active' ? `${consent.activeCount || 0} active consent record${consent.activeCount === 1 ? '' : 's'}` : 'No active consent',
    consent.current ? `Consent ${consent.current.id || consent.current.consentId || 'record'} · expires ${formatDate(consent.current.expiresAt)}` : `${consent.total || 0} consent records checked`
  );

  const approval = governance.humanApproval || {};
  setGovernedContext(
    contextCards.approval,
    approval.state || 'unavailable',
    approval.pendingCount ? `${approval.pendingCount} pending decision${approval.pendingCount === 1 ? '' : 's'}` : 'No pending approval',
    approval.current ? `Latest decision: ${approval.current.decision || approval.current.status || 'recorded'}` : `${approval.total || 0} approval records checked`
  );

  const rejected = governance.rejectedInformation || {};
  setGovernedContext(
    contextCards.rejected,
    rejected.state === 'rejected' ? 'active' : (rejected.state || 'unavailable'),
    rejected.total ? `${rejected.total} rejected event${rejected.total === 1 ? '' : 's'}` : 'No current rejected item',
    rejected.current ? `${rejected.current.source || 'Service'} · ${rejected.current.eventType || 'boundary rejection'}` : 'Deny-by-default boundary active'
  );

  const audit = governance.auditEvidence || {};
  setGovernedContext(
    contextCards.audit,
    audit.state || 'unavailable',
    audit.state === 'valid' ? `${audit.validChainCount || 0} of ${audit.chainCount || 4} chains valid` : 'Audit verification unavailable',
    `${audit.eventCount || 0} linked events · ${audit.unavailableChainCount || 0} unavailable chains`
  );

  const closure = governance.authorisedClosure || {};
  const closureState = closure.state === 'authorised' || closure.state === 'none' ? 'authorised' : closure.state;
  setGovernedContext(
    contextCards.closure,
    closureState || 'unavailable',
    closure.state === 'authorised' ? `${closure.authorisedCount || 0} authorised closure${closure.authorisedCount === 1 ? '' : 's'}` :
      closure.openCount ? `${closure.openCount} incident${closure.openCount === 1 ? '' : 's'} awaiting closure` : 'No open incident',
    closure.current ? `${closure.current.title || closure.current.id} · ${closure.current.status || 'status unavailable'}` : 'Evidence-gated closure active'
  );
}

function setConnection(state, label) {
  const chip = $('#connection-chip');
  chip.classList.remove('checking', 'online', 'offline');
  chip.classList.add(state);
  $('#connection-label').textContent = label;
}

function setOverall(onlineStates) {
  const overall = $('#overall');
  const count = onlineStates.filter(Boolean).length;
  overall.classList.remove('checking', 'online', 'offline');

  if (count === onlineStates.length) {
    overall.classList.add('online');
    $('#overall-label').textContent = 'ALL CORE SYSTEMS ONLINE';
    $('#overall-detail').textContent = 'GENEVIEVE App™ Main Command Centre, Health, Animal and Bridge are responding.';
    setConnection('online', 'GENEVIEVE App online');
  } else {
    overall.classList.add('offline');
    $('#overall-label').textContent = 'ATTENTION REQUIRED';
    $('#overall-detail').textContent = `${count} of ${onlineStates.length} core systems are responding.`;
    setConnection('offline', `${count}/${onlineStates.length} online`);
  }
}

function checkedTime() {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit'
  }).format(new Date());
}

function auditSectionEvents(name, section) {
  return (section?.events || []).map((event) => ({ ...event, auditService: name }));
}

function renderAudit(trail) {
  if (!trail) {
    $('#audit-summary').textContent = 'No full audit trail is attached to this run.';
    $('#audit-events').innerHTML = '';
    $('#audit-count').textContent = 'No linked trail';
    return;
  }

  const links = trail.evidenceLinks || {};
  $('#audit-summary').innerHTML =
    `<b class="${trail.chainValid ? 'pass' : 'fail'}">${trail.chainValid ? 'CHAIN VALID' : 'CHAIN INVALID'}</b><br>` +
    `Correlation ID: <code>${esc(trail.correlationId || '')}</code><br>` +
    `Total linked events: ${esc(trail.eventCount || 0)}<br>` +
    `<small>Bridge: ${esc(links.workerFinalHash || '—')}<br>` +
    `Health: ${esc(links.healthFinalHash || '—')}<br>` +
    `Animal: ${esc(links.animalFinalHash || '—')}<br>` +
    `Main Core: ${esc(links.mainCoreFinalHash || '—')}</small>`;

  const events = [
    ...auditSectionEvents('Controlled Bridge', trail.worker),
    ...auditSectionEvents('Health connector', trail.healthConnector),
    ...auditSectionEvents('Animal connector', trail.animalConnector),
    ...auditSectionEvents('Main Command Centre', trail.mainCore)
  ].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  $('#audit-count').textContent = `${events.length} linked event${events.length === 1 ? '' : 's'}`;
  $('#audit-events').innerHTML = events.map((event) =>
    `<details class="audit-event">` +
      `<summary><span>${esc(formatDate(event.at || ''))}</span><b>${esc(event.auditService)}</b>` +
      `<strong class="${event.outcome === 'success' || !event.outcome ? 'pass' : event.outcome === 'denied' ? 'denied' : 'fail'}">${esc(event.eventType || 'event')}</strong></summary>` +
      `<div><code>${esc(event.id || '')}</code><br>Outcome: ${esc(event.outcome || 'success')}<br>` +
      `Previous hash: <code>${esc(event.previousHash || '—')}</code><br>` +
      `Event hash: <code>${esc(event.hash || '—')}</code>` +
      `${event.metadata ? `<pre>${esc(JSON.stringify(event.metadata, null, 2))}</pre>` : ''}</div>` +
    `</details>`
  ).join('') || '<p>No events were returned.</p>';
}

async function openRunAudit(runId) {
  const local = localRuns().find((run) => run.id === runId);
  if (local?.fullAuditTrail) {
    renderAudit(local.fullAuditTrail);
    changeView('audit');
    return;
  }
  try {
    const data = await api(`/api/runs/${encodeURIComponent(runId)}/audit`);
    renderAudit(data.fullAuditTrail);
    changeView('audit');
  } catch (error) {
    $('#audit-summary').textContent = error.message;
  }
}

function renderRuns(runs) {
  $('#runs').innerHTML = runs.slice(0, 12).map((run) =>
    `<div class="run">` +
      `<b class="${run.status === 'passed' ? 'pass' : run.status === 'denied' ? 'denied' : 'fail'}">${esc(String(run.status || 'unknown').toUpperCase())}</b>` +
      `<strong>${esc(run.kind || 'governed journey')}</strong>` +
      `<small>${esc(formatDate(run.finishedAt || run.startedAt || ''))}</small>` +
      `${run.fullAuditTrail ? `<button class="audit-open" data-audit-run="${esc(run.id)}">Open full linked trail</button>` : ''}` +
    `</div>`
  ).join('') || '<p>No governed audit runs yet.</p>';
}

async function refresh() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  $('#refresh').disabled = true;
  setConnection('checking', 'Checking GENEVIEVE App');

  try {
    const data = await api('/api/status');
    const states = [
      setServiceCard('main', data.main),
      setServiceCard('health', data.health),
      setServiceCard('animal', data.animal),
      setServiceCard('bridge', data.bridge)
    ];
    renderGovernance(data.governance || {});
    setOverall(states);

    const recent = await api('/api/runs').catch(() => ({ runs: [] }));
    renderRuns(mergeRuns(recent.runs || []));
    $('#last-checked').textContent = `Last checked ${checkedTime()} · Vercel live check every 15 seconds`;
  } catch (error) {
    Object.entries(serviceCards).forEach(([key]) => setServiceCard(key, { ok: false, error: { message: error.message } }));
    setOverall([false, false, false, false]);
    setConnection('offline', 'Dashboard disconnected');
    $('#overall-detail').textContent = error.message;
    $('#last-checked').textContent = `Last attempt ${checkedTime()}`;
  } finally {
    refreshInProgress = false;
    $('#refresh').disabled = false;
  }
}

async function run(kind, path = '/api/pilot/run') {
  const result = $('#result');
  result.textContent = 'Running governed fictional GENEVIEVE App™ integration journey…';
  changeView('journeys');
  try {
    const data = await api(path, { method: 'POST', body: JSON.stringify(kind ? { kind } : {}) });
    const completed = data.run || data.result;
    rememberRun(completed);
    result.textContent = JSON.stringify(completed, null, 2);
    if (completed?.fullAuditTrail) renderAudit(completed.fullAuditTrail);
    await refresh();
  } catch (error) {
    result.textContent = error.message;
  }
}

async function prepareHealth(path = '/api/pilot/health/prepare', approvalEndpoint = '/api/pilot/health/approve-and-run') {
  const result = $('#result');
  result.textContent = 'Validating consent and creating the exact governed preview…';
  $('#approval-panel').classList.add('hidden');
  changeView('journeys');

  try {
    const data = await api(path, { method: 'POST', body: '{}' });
    pendingHealth = data.prepared;
    pendingApprovalEndpoint = approvalEndpoint;
    $('#exact-preview').textContent = pendingHealth.exactPreview || JSON.stringify(pendingHealth.preview, null, 2);
    $('#preview-hash').textContent = `SHA-256: ${pendingHealth.previewHash}`;
    const consent = pendingHealth.validation?.consent || {};
    $('#consent-evidence').innerHTML =
      `<b>Consent check: ${consent.required === false ? 'NOT PERSON-LINKED' : 'VALID'}</b><br>` +
      `${consent.consentId ? `Consent ID: ${esc(consent.consentId)}<br>` : ''}` +
      `${consent.expiresAt ? `Expires: ${esc(formatDate(consent.expiresAt))}<br>` : ''}` +
      `Tenant, source and exact-message boundary: VALID`;
    $('#confirm-preview').checked = false;
    $('#approval-panel').classList.remove('hidden');
    $('#approval-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    result.textContent = 'Prepared. Delivery is blocked until an authorised human approves the exact preview.';
  } catch (error) {
    pendingHealth = null;
    result.textContent = error.message;
  }
}

async function decideHealth(decision) {
  const result = $('#result');
  if (!pendingHealth) {
    result.textContent = 'Prepare a governed Health preview first.';
    return;
  }
  if (!$('#confirm-preview').checked) {
    result.textContent = 'Review the exact preview and tick the confirmation box before deciding.';
    return;
  }

  const body = {
    preparationId: pendingHealth.preparationId,
    previewHash: pendingHealth.previewHash,
    approvalToken: pendingHealth.approvalToken,
    decision,
    exactMessageConfirmed: true,
    approverId: 'hum_demo-reviewer-001',
    approverRole: 'authorised-human-reviewer',
    reason: $('#approval-reason').value,
    validation: pendingHealth.validation,
    boundary: pendingHealth.boundary,
    correlationId: pendingHealth.correlationId,
    parentCorrelationId: pendingHealth.parentCorrelationId || null
  };

  result.textContent = decision === 'approve'
    ? 'Approving, signing and sending the exact message through the controlled Bridge…'
    : 'Recording the human denial and linked audit evidence…';

  try {
    const data = await api(pendingApprovalEndpoint, { method: 'POST', body: JSON.stringify(body) });
    rememberRun(data.run);
    result.textContent = JSON.stringify(data.run, null, 2);
    if (data.run?.fullAuditTrail) renderAudit(data.run.fullAuditTrail);
    pendingHealth = null;
    $('#approval-panel').classList.add('hidden');
    await refresh();
  } catch (error) {
    result.textContent = error.message;
  }
}

document.addEventListener('click', (event) => {
  const auditButton = event.target.closest('[data-audit-run]');
  if (auditButton) return openRunAudit(auditButton.dataset.auditRun);
  const journeyButton = event.target.closest('[data-kind]');
  if (journeyButton) return run(journeyButton.dataset.kind);
});

$('#prepare-health').onclick = () => prepareHealth();
$('#prepare-shared').onclick = () => prepareHealth('/api/pilot/shared-both/prepare', '/api/pilot/shared-both/approve-and-run');
$('#approve-send').onclick = () => decideHealth('approve');
$('#deny').onclick = () => decideHealth('deny');
$('#security').onclick = () => run(null, '/api/pilot/security-tests');
$('#refresh').onclick = refresh;
$('#verify-audit').onclick = async () => {
  try {
    const data = await api('/api/audit/verify');
    $('#audit-summary').innerHTML =
      `<b class="${data.verification.valid ? 'pass' : 'fail'}">${data.verification.valid ? 'VERCEL PILOT LEDGER VALID' : 'LEDGER INVALID'}</b><br>` +
      `Verified warm-instance events: ${esc(data.summary.totalEventCount)}<br>` +
      `Final hash: <code>${esc(data.summary.ledgerFinalHash || '')}</code>`;
  } catch (error) {
    $('#audit-summary').textContent = error.message;
  }
};

refresh();
window.setInterval(refresh, 15000);
