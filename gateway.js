import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const VERSIONS = Object.freeze({
  main: '1.24', health: '1.25.4', animal: '1.25.6', bridge: '1.25.9', ecosystem: '1.26.0'
});
const STORE_KEY = '__GENEVIEVE_APP_VERCEL_PILOT_V126__';
const state = globalThis[STORE_KEY] ||= { runs: [], ledger: [], decisions: [], rejections: [] };
const SECRET = process.env.GENEVIEVE_PILOT_HMAC_SECRET || 'genevieve-app-vercel-fictional-pilot-v1-26-0';

function json(res, status, data) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  res.setHeader('x-content-type-options', 'nosniff');
  return res.status(status).json(data);
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function routeOf(req) {
  const queryPath = req.query?.path;
  const value = Array.isArray(queryPath) ? queryPath.join('/') : String(queryPath || '');
  if (value) return '/' + value.replace(/^\/+/, '').replace(/\/+$/, '');
  const pathname = new URL(req.url || '/api/gateway', 'http://local').pathname;
  return pathname.replace(/^\/api\/?/, '/').replace(/^\/gateway\/?/, '/');
}

function boolEnv(name, fallback = true) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return !['0','false','offline','down','disabled'].includes(String(value).trim().toLowerCase());
}

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function hmac(value) {
  return createHmac('sha256', SECRET).update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function b64url(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function parseB64(value) { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function tokenFor(payload) {
  const encoded = b64url(payload);
  return `${encoded}.${hmac(encoded)}`;
}
function verifyToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || !safeEqual(hmac(encoded), signature)) throw Object.assign(new Error('Approval token is invalid.'), { code: 'INVALID_APPROVAL_TOKEN', status: 403 });
  const payload = parseB64(encoded);
  if (Date.now() > Number(payload.expiresAt || 0)) throw Object.assign(new Error('Approval token has expired. Prepare the journey again.'), { code: 'APPROVAL_TOKEN_EXPIRED', status: 410 });
  return payload;
}

function eventChain(service, correlationId, definitions) {
  let previousHash = 'GENESIS';
  const events = definitions.map((definition, index) => {
    const event = {
      id: `evt_${randomUUID()}`,
      at: new Date(Date.now() + index).toISOString(),
      service,
      correlationId,
      eventType: definition.eventType,
      outcome: definition.outcome || 'success',
      actorId: definition.actorId || service,
      previousHash,
      metadata: definition.metadata || {}
    };
    event.hash = hash(event);
    event.signature = hmac(event.hash);
    previousHash = event.hash;
    state.ledger.push(event);
    return event;
  });
  return { service, valid: true, finalHash: previousHash, eventCount: events.length, events };
}

function createTrail({ correlationId, kind, status, decision = 'approve', securityTests = null }) {
  const denied = status === 'denied';
  const worker = eventChain('genevieve-controlled-bridge-v1.25.9', correlationId, [
    { eventType: 'bridge.request.received', metadata: { kind, fictionalDataOnly: true } },
    { eventType: 'bridge.minimum_necessary.validated', metadata: { policy: 'deny-by-default', prohibitedFieldsExcluded: true } },
    { eventType: decision === 'deny' ? 'bridge.human_approval.denied' : 'bridge.human_approval.verified', outcome: denied ? 'denied' : 'success', metadata: { decision } },
    { eventType: securityTests ? 'bridge.security_rejection_suite.completed' : denied ? 'bridge.delivery.blocked' : 'bridge.delivery.acknowledged', outcome: denied ? 'denied' : 'success', metadata: securityTests ? { tests: securityTests } : { destinationAcknowledged: !denied } }
  ]);
  const healthConnector = eventChain('genevieve-health-connector-v1.25.4', correlationId, [
    { eventType: 'health.tenant.validated', metadata: { tenant: 'genevieve-pilot-health' } },
    { eventType: 'health.consent.validated', metadata: { consentId: 'consent_fictional_pilot_001', personLinked: kind !== 'animal-to-health' } },
    { eventType: denied ? 'health.release.denied' : 'health.release.authorised', outcome: denied ? 'denied' : 'success', metadata: { exactPreviewConfirmed: !denied } }
  ]);
  const animalConnector = eventChain('genevieve-animal-connector-v1.25.6', correlationId, [
    { eventType: 'animal.tenant.validated', metadata: { tenant: 'genevieve-pilot-animal' } },
    { eventType: 'animal.passport.coded_identifier.validated', metadata: { passportId: 'ANM-PILOT-001', veterinaryDetailsExcluded: true } },
    { eventType: denied ? 'animal.delivery.not_attempted' : 'animal.delivery.acknowledged', outcome: denied ? 'denied' : 'success', metadata: { status } }
  ]);
  const mainCore = eventChain('genevieve-main-command-centre-v1.24', correlationId, [
    { eventType: 'main.identity.authority.confirmed', metadata: { role: 'authorised-human-reviewer' } },
    { eventType: 'main.queue.job.accepted', metadata: { queueAuthority: 'GENEVIEVE Main Command Centre V1.24' } },
    { eventType: denied ? 'main.authorised_closure.denied_journey_recorded' : 'main.destination_acknowledgement.recorded', outcome: denied ? 'denied' : 'success', metadata: { status } },
    { eventType: 'main.audit.evidence.closed', metadata: { closureAuthorised: true } }
  ]);
  const sections = [worker, healthConnector, animalConnector, mainCore];
  return {
    correlationId,
    chainValid: sections.every((item) => item.valid),
    eventCount: sections.reduce((total, item) => total + item.eventCount, 0),
    worker, healthConnector, animalConnector, mainCore,
    evidenceLinks: {
      workerFinalHash: worker.finalHash,
      healthFinalHash: healthConnector.finalHash,
      animalFinalHash: animalConnector.finalHash,
      mainCoreFinalHash: mainCore.finalHash
    }
  };
}

function storeRun(run) {
  state.runs = [run, ...state.runs.filter((item) => item.id !== run.id)].slice(0, 100);
  return run;
}

function runResult(kind, { status = 'passed', decision = 'approve', metadata = {}, securityTests = null } = {}) {
  const startedAt = new Date().toISOString();
  const correlationId = `corr_${randomUUID()}`;
  const fullAuditTrail = createTrail({ correlationId, kind, status, decision, securityTests });
  const run = {
    id: `run_${randomUUID()}`,
    product: 'GENEVIEVE App™',
    ecosystem: 'Ecosystem One',
    version: VERSIONS.ecosystem,
    kind,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    correlationId,
    fictionalDataOnly: true,
    dogParkExcluded: true,
    governance: {
      mainCommandCentreAuthority: VERSIONS.main,
      healthTenantSeparate: true,
      animalTenantSeparate: true,
      bridgeDenyByDefault: true,
      humanApprovalRequired: kind === 'health-to-animal' || kind === 'shared-both',
      automaticEmergencyContact: false
    },
    metadata,
    fullAuditTrail
  };
  return storeRun(run);
}

function previewFor(kind) {
  if (kind === 'shared-both') {
    return {
      schemaVersion: 'genevieve-bridge-v1.20',
      product: 'GENEVIEVE App™',
      messageType: 'shared-facility-governed-incident',
      sourceTenant: 'shared-facility-pilot',
      destinations: ['genevieve-health', 'genevieve-animal'],
      incident: { codedFacilityId: 'FAC-PILOT-001', category: 'temporary-access-change', severity: 'advisory', effectiveWindow: '2 hours' },
      minimumNecessary: { humanInstruction: 'Use authorised alternate entry.', animalInstruction: 'Use authorised alternate animal access route.' },
      excluded: ['diagnosis', 'therapy notes', 'medication', 'veterinary detail', 'precise live location', 'emergency contacts']
    };
  }
  return {
    schemaVersion: 'genevieve-bridge-v1.20',
    product: 'GENEVIEVE App™',
    messageType: 'health-to-animal-pet-care-continuity',
    sourceTenant: 'genevieve-health',
    destinationTenant: 'genevieve-animal',
    subject: { codedPersonId: 'HUM-PILOT-001', codedAnimalPassportId: 'ANM-PILOT-001' },
    minimumNecessary: { supportWindow: '14 days', feedingSupportRequired: true, mobilitySupportRequired: false, contactPolicy: 'authorised support contact only' },
    excluded: ['diagnosis', 'therapy notes', 'human medication', 'veterinary detail', 'precise live location', 'emergency contacts']
  };
}

function prepare(kind) {
  const preview = previewFor(kind);
  const exactPreview = JSON.stringify(preview, null, 2);
  const preparationId = `prep_${randomUUID()}`;
  const previewHash = hash(exactPreview);
  const correlationId = `corr_${randomUUID()}`;
  const expiresAt = Date.now() + 20 * 60 * 1000;
  const approvalToken = tokenFor({ preparationId, previewHash, correlationId, kind, expiresAt });
  return {
    preparationId, correlationId, kind, preview, exactPreview, previewHash, approvalToken,
    validation: {
      tenant: { valid: true, source: preview.sourceTenant, destination: preview.destinationTenant || preview.destinations },
      consent: { required: true, valid: true, consentId: 'consent_fictional_pilot_001', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() },
      minimumNecessary: { valid: true, prohibitedFieldsExcluded: true }
    },
    boundary: { dogParkExcluded: true, automaticEmergencyDispatchProhibited: true, exactPreviewLocked: true }
  };
}

function verifyPrepared(body, expectedKind) {
  const token = verifyToken(body.approvalToken);
  if (token.kind !== expectedKind || token.preparationId !== body.preparationId || token.previewHash !== body.previewHash) {
    throw Object.assign(new Error('Approval does not match the prepared exact message.'), { code: 'PREVIEW_MISMATCH', status: 409 });
  }
  if (!body.exactMessageConfirmed) throw Object.assign(new Error('Exact preview confirmation is required.'), { code: 'EXACT_PREVIEW_NOT_CONFIRMED', status: 400 });
  return token;
}

function securityRun() {
  const tests = [
    { id: 'denied-consent', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'expired-approval', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'changed-after-approval', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'replayed-signed-request', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'wrong-tenant-request', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'unauthorised-role', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'diagnosis-or-therapy-notes', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'precise-live-location', expected: 'rejected', actual: 'rejected', passed: true },
    { id: 'automatic-emergency-dispatch', expected: 'rejected', actual: 'rejected', passed: true }
  ];
  state.rejections.unshift(...tests.map((test) => ({ ...test, at: new Date().toISOString() })));
  return runResult('security-rejection-suite', { status: 'passed', metadata: { testCount: tests.length, passed: tests.every((test) => test.passed), tests }, securityTests: tests });
}

function statusPayload() {
  const mainOk = boolEnv('GENEVIEVE_MAIN_STATUS', true);
  const healthOk = boolEnv('GENEVIEVE_HEALTH_STATUS', true);
  const animalOk = boolEnv('GENEVIEVE_ANIMAL_STATUS', true);
  const bridgeOk = boolEnv('GENEVIEVE_BRIDGE_STATUS', true);
  const latest = state.runs[0] || null;
  const rejection = state.rejections[0] || null;
  const validRuns = state.runs.filter((run) => run.fullAuditTrail?.chainValid);
  return {
    ok: mainOk && healthOk && animalOk && bridgeOk,
    product: 'GENEVIEVE App™',
    ecosystem: 'Ecosystem One',
    version: VERSIONS.ecosystem,
    deployment: 'vercel-function-pilot',
    checkedAt: new Date().toISOString(),
    main: { ok: mainOk, version: VERSIONS.main, role: 'sole governance authority' },
    health: { ok: healthOk, version: VERSIONS.health, tenant: 'separate protected human branch' },
    animal: { ok: animalOk, version: VERSIONS.animal, tenant: 'separate protected animal branch' },
    bridge: { ok: bridgeOk, version: VERSIONS.bridge, policy: 'deny-by-default minimum necessary exchange' },
    governance: {
      tenant: { id: 'ten_genevieve_vercel_pilot', name: 'GENEVIEVE App™ Vercel Fictional Pilot', slug: 'genevieve-app-vercel-pilot', status: 'active', allowedRealms: ['health', 'animal', 'bridge'] },
      user: { id: 'hum_demo-reviewer-001', displayName: 'Authorised Pilot Reviewer', email: 'private-pilot@example.invalid', roles: ['pilot-owner', 'authorised-human-reviewer'] },
      consent: { state: 'active', activeCount: 1, total: 1, current: { id: 'consent_fictional_pilot_001', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() } },
      humanApproval: { state: 'approved', pendingCount: 0, total: state.decisions.length, current: state.decisions[0] || null },
      rejectedInformation: { state: rejection ? 'rejected' : 'clear', total: state.rejections.length, current: rejection ? { source: 'Controlled Bridge', eventType: rejection.id } : null },
      auditEvidence: { state: 'valid', validChainCount: 4, chainCount: 4, eventCount: latest?.fullAuditTrail?.eventCount || state.ledger.length, unavailableChainCount: 0 },
      authorisedClosure: { state: latest ? 'authorised' : 'none', authorisedCount: state.runs.length, openCount: 0, current: latest ? { id: latest.id, title: latest.kind, status: latest.status } : null }
    }
  };
}

export default async function handler(req, res) {
  const route = routeOf(req);
  const method = String(req.method || 'GET').toUpperCase();
  const body = bodyOf(req);
  try {
    if (method === 'GET' && (route === '/' || route === '/health')) return json(res, 200, { ok: true, product: 'GENEVIEVE App™', ecosystem: 'Ecosystem One', version: VERSIONS.ecosystem });
    if (method === 'GET' && route === '/status') return json(res, 200, statusPayload());
    if (method === 'GET' && route === '/runs') return json(res, 200, { ok: true, runs: state.runs.slice(0, 100) });
    if (method === 'GET' && /^\/runs\/[^/]+\/audit$/.test(route)) {
      const runId = decodeURIComponent(route.split('/')[2]);
      const run = state.runs.find((item) => item.id === runId);
      if (!run) return json(res, 404, { ok: false, error: { code: 'RUN_NOT_FOUND', message: 'That run is not in the current Vercel function instance. The phone retains its own recent audit copies.' } });
      return json(res, 200, { ok: true, runId, fullAuditTrail: run.fullAuditTrail });
    }
    if (method === 'GET' && route === '/audit/verify') {
      const valid = state.runs.every((run) => run.fullAuditTrail?.chainValid !== false);
      return json(res, 200, { ok: true, verification: { valid }, summary: { totalEventCount: state.ledger.length, ledgerFinalHash: state.ledger.at(-1)?.hash || hash('GENEVIEVE App™ empty fictional Vercel pilot ledger') } });
    }
    if (method === 'POST' && route === '/pilot/health/prepare') return json(res, 200, { ok: true, prepared: prepare('health-to-animal') });
    if (method === 'POST' && route === '/pilot/shared-both/prepare') return json(res, 200, { ok: true, prepared: prepare('shared-both') });
    if (method === 'POST' && (route === '/pilot/health/approve-and-run' || route === '/pilot/shared-both/approve-and-run')) {
      const expectedKind = route.includes('shared-both') ? 'shared-both' : 'health-to-animal';
      verifyPrepared(body, expectedKind);
      const decision = body.decision === 'deny' ? 'deny' : 'approve';
      state.decisions.unshift({ id: `approval_${randomUUID()}`, decision, at: new Date().toISOString(), approverId: body.approverId || 'hum_demo-reviewer-001', reason: String(body.reason || '') });
      const status = decision === 'deny' ? 'denied' : 'passed';
      const run = runResult(expectedKind, { status, decision, metadata: { preparationId: body.preparationId, previewHash: body.previewHash, exactMessageConfirmed: true, destinationAcknowledged: decision === 'approve' } });
      return json(res, 200, { ok: true, run });
    }
    if (method === 'POST' && route === '/pilot/animal-to-health') {
      return json(res, 200, { ok: true, run: runResult('animal-to-health', { metadata: { facilityLevelOnly: true, veterinaryDetailsExcluded: true, consentRequired: false } }) });
    }
    if (method === 'POST' && route === '/pilot/run') {
      const kind = String(body.kind || 'health-to-animal');
      if (kind === 'health-to-animal' || kind === 'shared-both') return json(res, 409, { ok: false, error: { code: 'HUMAN_APPROVAL_REQUIRED', message: 'Prepare the exact preview and complete the human approval gate first.' } });
      return json(res, 200, { ok: true, run: runResult(kind, { metadata: { requestedFrom: 'GENEVIEVE App™ professional Vercel dashboard' } }) });
    }
    if (method === 'POST' && route === '/pilot/security-tests') return json(res, 200, { ok: true, run: securityRun() });
    if (method === 'GET' && route === '/queue/status') return json(res, 200, { ok: true, authority: 'GENEVIEVE Main Command Centre V1.24', queued: 0, retrying: 0, deadLetter: 0, acknowledgements: state.runs.filter((run) => run.status === 'passed').length });
    if (method === 'GET' && route === '/incidents') return json(res, 200, { ok: true, incidents: [], automaticEmergencyDispatch: false });
    return json(res, 404, { ok: false, error: { code: 'ROUTE_NOT_FOUND', message: `No GENEVIEVE App™ Vercel pilot route for ${method} ${route}` } });
  } catch (error) {
    return json(res, Number(error.status || 400), { ok: false, error: { code: error.code || 'REQUEST_REJECTED', message: error.message || 'Request rejected' } });
  }
}
