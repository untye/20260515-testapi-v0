const STORAGE_PREFIX = 'untye.demo.overhaul.v1';

const authorityJwtSlot = document.getElementById('authorityJwtSlot');
const authorityTokenSlot = document.getElementById('authorityTokenSlot');
const authorityGroupInput = document.getElementById('authorityGroupInput');
const authorityMessageInput = document.getElementById('authorityMessageInput');
const authorityScopeInput = document.getElementById('authorityScopeInput');
const authorityNameInput = document.getElementById('authorityNameInput');
const issueCertificateBtn = document.getElementById('issueCertificateBtn');
const authorityStatus = document.getElementById('authorityStatus');
const authorityCertificateTray = document.getElementById('authorityCertificateTray');
const currentBatchLabel = document.getElementById('currentBatchLabel');
const currentRootBadge = document.getElementById('currentRootBadge');
const adminTokenInput = document.getElementById('adminTokenInput');
const nextBatchBtn = document.getElementById('nextBatchBtn');
const batchStatus = document.getElementById('batchStatus');

const createJwtBtn = document.getElementById('createJwtBtn');
const createTokenBtn = document.getElementById('createTokenBtn');
const userStatus = document.getElementById('userStatus');
const proofNameInput = document.getElementById('proofNameInput');
const userInventoryTray = document.getElementById('userInventoryTray');
const userInventoryCount = document.getElementById('userInventoryCount');
const userCertificateSlot = document.getElementById('userCertificateSlot');
const userTokenSlot = document.getElementById('userTokenSlot');
const aggregateProofBtn = document.getElementById('aggregateProofBtn');
const clearUserSlotsBtn = document.getElementById('clearUserSlotsBtn');
const aggregationStatus = document.getElementById('aggregationStatus');

const verifierProofSlot = document.getElementById('verifierProofSlot');
const verifyProofBtn = document.getElementById('verifyProofBtn');
const clearVerifierSlotBtn = document.getElementById('clearVerifierSlotBtn');
const verifierStatus = document.getElementById('verifierStatus');
const verificationLog = document.getElementById('verificationLog');

const apiBase = '/api';

const state = loadState();
let draggedItemId = null;

function defaultState() {
  return {
    authority: {
      groupName: 'demo-users',
      message: 'demo-message',
      scope: 'demo-scope',
      certificateName: 'Cert',
      adminToken: localStorage.getItem(`${STORAGE_PREFIX}.adminToken`) || '',
      batchNumber: Number(localStorage.getItem(`${STORAGE_PREFIX}.batchNumber`) || '1'),
      currentRoot: 'unknown'
    },
    items: {},
    trays: {
      authorityCertificates: [],
      userInventory: [],
      userProofs: []
    },
    slots: {
      authority: {
        jwt: null,
        token: null
      },
      user: {
        certificate: null,
        token: null
      },
      verifier: {
        proof: null
      }
    },
    logs: {
      verification: []
    },
    messages: {
      authority: '',
      user: '',
      aggregation: '',
      verifier: '',
      batch: ''
    }
  };
}

function loadState() {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}.state`);
  if (!raw) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function normalizeState(input) {
  const base = defaultState();
  const source = input || {};
  base.authority = { ...base.authority, ...(source.authority || {}) };
  base.items = source.items || {};
  base.trays = {
    authorityCertificates: Array.isArray(source.trays?.authorityCertificates) ? source.trays.authorityCertificates : [],
    userInventory: Array.isArray(source.trays?.userInventory) ? source.trays.userInventory : [],
    userProofs: Array.isArray(source.trays?.userProofs) ? source.trays.userProofs : []
  };
  base.slots = {
    authority: { ...base.slots.authority, ...(source.slots?.authority || {}) },
    user: { ...base.slots.user, ...(source.slots?.user || {}) },
    verifier: { ...base.slots.verifier, ...(source.slots?.verifier || {}) }
  };
  base.logs = {
    verification: Array.isArray(source.logs?.verification) ? source.logs.verification : []
  };
  base.messages = { ...base.messages, ...(source.messages || {}) };
  return base;
}

function persistState() {
  localStorage.setItem(`${STORAGE_PREFIX}.state`, JSON.stringify(state));
  localStorage.setItem(`${STORAGE_PREFIX}.adminToken`, state.authority.adminToken || '');
  localStorage.setItem(`${STORAGE_PREFIX}.batchNumber`, String(state.authority.batchNumber || 1));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shortText(value, length = 10) {
  const stringValue = String(value || '');
  return stringValue.length > length ? `${stringValue.slice(0, length)}...` : stringValue;
}

function prettyTime(value) {
  return new Date(value).toLocaleString();
}

function buildFakeJwt(sub) {
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ sub, iss: 'voidauth-demo', aud: 'untye-demo', iat: Math.floor(Date.now() / 1000) });
  return `${header}.${payload}.`;
}

function apiHeaders(jwt) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`
  };
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function itemTypeLabel(kind) {
  return {
    'jwt-id': 'JWT/ID',
    token: 'token',
    certificate: 'certificate',
    proof: 'proof'
  }[kind] || kind;
}

function fallbackNameForKind(kind) {
  return {
    'jwt-id': 'ID',
    token: 'Token',
    certificate: 'Certificate',
    proof: 'Proof'
  }[kind] || 'Item';
}

function uniqueName(kind, desiredName, currentId = null) {
  const trimmed = String(desiredName || '').trim();
  const baseName = trimmed || fallbackNameForKind(kind);
  const existingNames = new Set(
    Object.values(state.items)
      .filter((item) => item && item.kind === kind && item.id !== currentId)
      .map((item) => item.name)
      .filter(Boolean)
  );

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 1;
  while (existingNames.has(`${baseName} (${suffix})`)) {
    suffix += 1;
  }

  return `${baseName} (${suffix})`;
}

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createItem(kind, data, overrides = {}) {
  const id = crypto.randomUUID();
  return {
    id,
    kind,
    createdAt: new Date().toISOString(),
    name: uniqueName(kind, overrides.name || data?.name || fallbackNameForKind(kind), id),
    ...overrides,
    data: cloneValue(data)
  };
}

function addItemToTray(trayName, item) {
  state.items[item.id] = item;
  state.trays[trayName].unshift(item.id);
  persistState();
  render();
  return item;
}

function addReferenceToTray(trayName, itemId) {
  if (!state.trays[trayName]) {
    return;
  }

  state.trays[trayName].unshift(itemId);
  persistState();
  render();
}

function setSlotReference(path, itemId) {
  const [section, slotName] = path.split('.');
  state.slots[section][slotName] = itemId;
  persistState();
  render();
}

function clearSlot(path) {
  const [section, slotName] = path.split('.');
  state.slots[section][slotName] = null;
  persistState();
  render();
}

function getItem(id) {
  return id ? state.items[id] || null : null;
}

function getSlot(path) {
  const [section, slotName] = path.split('.');
  return getItem(state.slots[section][slotName]);
}

function setMessage(key, message) {
  state.messages[key] = message;
  persistState();
  render();
}

function createJwtIdItem() {
  const sub = `user-${shortText(crypto.randomUUID().replaceAll('-', ''), 12)}`;
  const jwt = buildFakeJwt(sub);
  const item = createItem('jwt-id', { jwt, sub }, {
    name: uniqueName('jwt-id', 'ID'),
    title: uniqueName('jwt-id', 'ID'),
    subtitle: `sub: ${sub}`,
    detail: ''
  });
  addItemToTray('userInventory', item);
  setMessage('user', 'Created a new ID and added it to the inventory.');
}

async function createTokenItem() {
  const identity = await apiJson(`${apiBase}/newidentity`);
  const item = createItem('token', identity, {
    name: uniqueName('token', 'Token'),
    title: uniqueName('token', 'Token'),
    subtitle: '', //`commitment: ${shortText(identity.commitment, 16)}`,
    detail: ''
  });
  addItemToTray('userInventory', item);
  setMessage('user', 'Created a new token and added it to the inventory.');
}

function refreshRootBadge(root) {
  state.authority.currentRoot = root || 'unknown';
  persistState();
}

async function syncAuthorityRoot() {
  const groupName = state.authority.groupName.trim();
  if (!groupName) {
    refreshRootBadge('unknown');
    return;
  }

  try {
    const result = await apiJson(`${apiBase}/grouproot?groupName=${encodeURIComponent(groupName)}`);
    refreshRootBadge(result.root || 'unknown');
  } catch {
    refreshRootBadge('unknown');
  }
  render();
}

async function hydrateCertificate(certItem) {
  const jwtItem = getItem(certItem.data.jwtItemId);
  const tokenItem = getItem(certItem.data.tokenItemId);
  const releaseBatchNumber = Number(certItem.data.releaseBatchNumber || certItem.data.batchNumber || state.authority.batchNumber);

  if (!jwtItem || !tokenItem) {
    certItem.status = 'error';
    certItem.statusDetail = 'Linked JWT/ID or token is missing.';
    return certItem;
  }

  try {
    const query = new URLSearchParams({
      groupName: certItem.data.groupName,
      commitment: tokenItem.data.commitment
    });

    const proof = await apiJson(`${apiBase}/getmerkleproof?${query}`, {
      headers: apiHeaders(jwtItem.data.jwt)
    });

    certItem.status = 'active';
    certItem.statusDetail = 'Certificate is ready to drag.';
    certItem.data.merkleProof = proof;
    certItem.data.issuedAt = certItem.data.issuedAt || new Date().toISOString();
    certItem.data.batchNumber = releaseBatchNumber;
    certItem.data.releaseBatchNumber = releaseBatchNumber;
  } catch (error) {
    if (String(error.message || '').includes('member not in group')) {
      certItem.status = 'locked';
      certItem.statusDetail = `Locked until batch ${releaseBatchNumber}.`;
    } else {
      certItem.status = 'error';
      certItem.statusDetail = error.message;
    }
  }

  return certItem;
}

async function issueCertificate() {
  const jwtItem = getSlot('authority.jwt');
  const tokenItem = getSlot('authority.token');
  const groupName = state.authority.groupName.trim();
  const message = state.authority.message.trim();
  const scope = state.authority.scope.trim();
  const certificateName = uniqueName('certificate', authorityNameInput.value.trim() || state.authority.certificateName || 'Certificate');

  state.authority.certificateName = certificateName;

  if (!jwtItem || jwtItem.kind !== 'jwt-id') {
    throw new Error('Drop a JWT/ID into the authority slot first.');
  }

  if (!tokenItem || tokenItem.kind !== 'token') {
    throw new Error('Drop a token into the authority slot first.');
  }

  if (!groupName) {
    throw new Error('Group name is required.');
  }

  const certItem = createItem('certificate', {
    name: certificateName,
    groupName,
    message,
    scope,
    jwtItemId: jwtItem.id,
    tokenItemId: tokenItem.id,
    merkleProof: null,
    batchNumber: state.authority.batchNumber,
    releaseBatchNumber: state.authority.batchNumber + 1,
    issuedAt: new Date().toISOString()
  }, {
    name: certificateName,
    title: certificateName,
    subtitle: `${groupName} | ${message}`,
    detail: `Scope ${scope}`,
    statusDetail: `Locked until Batch ${state.authority.batchNumber + 1}.`
  });

  addItemToTray('authorityCertificates', certItem);
  setMessage('authority', 'Certificate staged.');

  try {
    await apiJson(`${apiBase}/addtogroup`, {
      method: 'POST',
      headers: apiHeaders(jwtItem.data.jwt),
      body: JSON.stringify({
        groupName,
        commitment: tokenItem.data.commitment
      })
    });
  } catch (error) {
    certItem.statusDetail = error.message;
    persistState();
    render();
    throw error;
  }

  await hydrateCertificate(certItem);
  persistState();
  render();
}

async function hydratePendingCertificates() {
  const tray = state.trays.authorityCertificates;
  for (const certId of tray) {
    const certItem = getItem(certId);
    if (!certItem || certItem.kind !== 'certificate') {
      continue;
    }

    const releaseBatchNumber = Number(certItem.data.releaseBatchNumber || certItem.data.batchNumber || 1);
    if (state.authority.batchNumber < releaseBatchNumber) {
      certItem.statusDetail = `Locked until batch ${releaseBatchNumber}.`;
      continue;
    }

    if (!certItem.data.merkleProof) {
      await hydrateCertificate(certItem);
    }
  }

  persistState();
  render();
}

async function advanceNextBatch() {
  const groupName = state.authority.groupName.trim();
  const adminToken = state.authority.adminToken.trim();

  if (!groupName) {
    throw new Error('Group name is required.');
  }

  if (!adminToken) {
    throw new Error('Admin token is required.');
  }

  await apiJson(`${apiBase}/nextbatch?groupName=${encodeURIComponent(groupName)}&admin_token=${encodeURIComponent(adminToken)}`);
  state.authority.batchNumber += 1;
  persistState();
  await syncAuthorityRoot();
  await hydratePendingCertificates();
  setMessage('batch', `Advanced to batch ${state.authority.batchNumber}.`);
}

async function aggregateProof() {
  const certItem = getSlot('user.certificate');
  const tokenItem = getSlot('user.token');

  if (!certItem || certItem.kind !== 'certificate') {
    throw new Error('Drop a certificate into the user certificate slot.');
  }

  if (!tokenItem || tokenItem.kind !== 'token') {
    throw new Error('Drop a token into the user token slot.');
  }

  if (certItem.status !== 'active' || !certItem.data.merkleProof) {
    throw new Error('That certificate is not active yet.');
  }

  const proof = await apiJson(`${apiBase}/generateproof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      privateKey: tokenItem.data.privateKey,
      merkleProof: certItem.data.merkleProof,
      message: certItem.data.message,
      scope: certItem.data.scope
    })
  });

  const proofItem = createItem('proof', {
    name: uniqueName('proof', proofNameInput.value.trim() || 'Proof'),
    groupName: certItem.data.groupName,
    message: certItem.data.message,
    scope: certItem.data.scope,
    batchNumber: certItem.data.batchNumber,
    proof,
    certificateId: certItem.id,
    tokenId: tokenItem.id,
    generatedAt: new Date().toISOString()
  }, {
    name: uniqueName('proof', proofNameInput.value.trim() || 'Proof'),
    title: uniqueName('proof', proofNameInput.value.trim() || 'Proof'),
    subtitle: `${certItem.data.groupName} | ${certItem.data.message}`,
    detail: `Batch ${certItem.data.batchNumber} | Scope ${certItem.data.scope}`,
    statusDetail: 'Proof generated and ready to verify.'
  });

  addItemToTray('userInventory', proofItem);
  setMessage('aggregation', 'Proof generated and added to the inventory.');
}

async function verifyProof() {
  const proofItem = getSlot('verifier.proof');

  if (!proofItem || proofItem.kind !== 'proof') {
    throw new Error('Drop a proof into the verifier slot first.');
  }

  const startedAt = performance.now();
  const rootResult = await apiJson(`${apiBase}/grouproot?groupName=${encodeURIComponent(proofItem.data.groupName)}`);
  const verification = await apiJson(`${apiBase}/verifyproof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      groupName: proofItem.data.groupName,
      proof: proofItem.data.proof
    })
  });
  const duration = Math.max(0, Math.round(performance.now() - startedAt));

  const verified = Boolean(verification.verified);
  const batchMatches = proofItem.data.proof?.merkleTreeRoot === rootResult.root;

  state.logs.verification.unshift({
    id: crypto.randomUUID(),
    checkedAt: new Date().toISOString(),
    verified,
    duration,
    batchNumber: proofItem.data.batchNumber,
    proofName: proofItem.name,
    currentRoot: rootResult.root,
    batchMatches,
    proofId: proofItem.id,
    message: verified ? 'Proof verified successfully.' : verification.error || 'Proof rejected.'
  });

  setMessage('verifier', verified
    ? `Verified in ${duration}ms with the current batch root.`
    : `Verification failed in ${duration}ms.`);
  persistState();
  render();
}

function renderItemCard(item) {
  const batchLabel = typeof item.data?.batchNumber === 'number' ? `Batch ${item.data.batchNumber}` : '';
  const releaseBatchLabel = typeof item.data?.releaseBatchNumber === 'number' ? `Batch ${item.data.releaseBatchNumber}` : '';
  const currentBatch = Number(state.authority.batchNumber || 1);
  const itemBatch = Number(item.data?.releaseBatchNumber || item.data?.batchNumber || 0);
  const isBatchItem = item.kind === 'certificate' || item.kind === 'proof';
  const isCurrentBatch = !isBatchItem || itemBatch === currentBatch;
  const draggable = item.kind === 'certificate'
    ? itemBatch <= currentBatch
    : true;
  const cardName = item.name || item.title || itemTypeLabel(item.kind);
  const visibleBatchLabel = releaseBatchLabel || batchLabel;
  const statusText = item.kind === 'certificate'
    ? item.statusDetail || `Locked until Batch ${item.data?.releaseBatchNumber || item.data?.batchNumber || state.authority.batchNumber}`
    : item.kind === 'proof'
      ? item.statusDetail || batchLabel
      : item.detail || '';
  /*const tokenCommitment = item.kind === 'token'
    ? `<div class="token-commitment-handle" draggable="true" data-item-id="${escapeHtml(item.id)}" data-drag-kind="token-commitment">commitment</div>
       <div class="token-commitment-label">${escapeHtml(shortText(item.data?.commitment || '', 18))}</div>`
    : ''; */
  const tokenCommitment = item.kind === 'token'
    ? renderTokenCommitmentCard(item) // TODO MAKE COMMITMENT CARD 
    : ''; 
  const hashLabel = shortText(item.id, 8);
  const tokenMeta = item.kind === 'token'
    ? `
      <p class="item-subtitle">public key: ${escapeHtml(shortText(item.data?.publicKey || '', 16))}</p>
      <p class="item-subtitle">private key: ${escapeHtml(shortText(item.data?.privateKey || '', 16))}</p>
    `
    : '';
  const jwtMeta = item.kind === 'jwt-id'
    ? `
      <p class="item-subtitle">sub: ${escapeHtml(shortText(item.data?.sub || '', 16))}</p>
    `
    : '';

  return `
    <article class="item-card ${isBatchItem && !isCurrentBatch ? 'item-stale' : ''}" data-item-id="${escapeHtml(item.id)}" data-kind="${escapeHtml(item.kind)}" draggable="${draggable ? 'true' : 'false'}">
      <div class="item-top">
        <h3 class="item-title">${escapeHtml(cardName)}</h3>
        ${visibleBatchLabel ? `<span class="item-chip">${escapeHtml(visibleBatchLabel)}</span>` : ''}
      </div>
      ${jwtMeta}
      ${tokenMeta}
      <p class="item-subtitle">${escapeHtml(item.kind === 'certificate' ? item.subtitle || statusText : item.kind === 'proof' ? item.subtitle || statusText : item.subtitle || '')}</p>
      ${item.kind === 'certificate' ? `<p class="item-detail">${escapeHtml(statusText)}</p>` : ''}
      ${item.kind === 'proof' ? `<p class="item-detail">${escapeHtml(statusText)}</p>` : ''}
      ${tokenCommitment}
      <div class="item-hash">${escapeHtml(hashLabel)}</div>
    </article>
  `;
}

function renderTokenCommitmentCard(item, haveHash=false) {
  const commitment = item.data?.commitment || '';
  const hashLabel = shortText(item.id, 8);
  const commitmentLabel = shortText(commitment, 24);
  const batchLabel = typeof item.data?.batchNumber === 'number' ? `Batch ${item.data.batchNumber}` : '';

  return `
    <article class="item-card item-card--commitment" draggable="true" data-item-id="${escapeHtml(item.id)}" data-drag-kind="token-commitment">
      <div class="item-top">
        <h3 class="item-title">Commitment</h3>
        ${batchLabel ? `<span class="item-chip">${escapeHtml(batchLabel)}</span>` : ''}
      </div>
      <p class="item-subtitle">${escapeHtml(commitmentLabel)} (For ${escapeHtml(item.name)})</p>
      ${haveHash ? `<div class="item-hash">${escapeHtml(hashLabel)}</div>` : ''}
    </article>
  `;
}

function renderEmptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function renderSlot(path, fallbackText) {
  const item = getSlot(path);
  if (!item) {
    return `<div class="slot-empty">${escapeHtml(fallbackText)}</div>`;
  }

  if (path === 'authority.token' && item.kind === 'token') {
    return renderTokenCommitmentCard(item);
  }

  return renderItemCard(item);
}

function renderTray(trayName, fallbackText) {
  const ids = state.trays[trayName] || [];
  if (!ids.length) {
    return renderEmptyState(fallbackText);
  }

  return ids.map((id) => renderItemCard(getItem(id))).join('');
}

function renderVerificationLog() {
  if (!state.logs.verification.length) {
    return renderEmptyState('Verification results will appear here.');
  }

  return state.logs.verification.map((entry, index) => {
    const title = `${entry.verified ? 'Proof verified' : 'Proof rejected'}: ${entry.proofName || 'Proof'} | ${new Date(entry.checkedAt).toLocaleTimeString()}`;
    const rootSummary = `Batch ${entry.batchNumber} (${shortText(entry.currentRoot, 24)})`;
    const resultLine = entry.message || (entry.verified ? 'Proof verified.' : 'Proof rejected.');

    return `
      ${index > 0 ? '<hr class="log-divider" />' : ''}
      <article class="log-entry">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(rootSummary)}</p>
        <p>${escapeHtml(entry.batchMatches ? 'Batch matched live authority state.' : 'Batch no longer matches live authority state.')}</p>
        <p class="log-final">${escapeHtml(resultLine)}</p>
      </article>
    `;
  }).join('');
}

function bindDropZones() {
  document.querySelectorAll('[data-drop-zone="slot"], [data-drop-zone="tray"]').forEach((zone) => {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('is-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('is-over');
    });

    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('is-over');

      const draggedId = event.dataTransfer.getData('text/plain') || draggedItemId;
      if (!draggedId) {
        return;
      }

      const source = getItem(draggedId);
      if (!source) {
        return;
      }

      const draggedKind = event.dataTransfer.getData('application/x-untye-kind') || source.kind;
      const sourceKind = draggedKind === 'token-commitment' ? 'token-commitment' : source.kind;

      if (source.kind === 'certificate') {
        const releaseBatchNumber = Number(source.data.releaseBatchNumber || source.data.batchNumber || 0);
        if (state.authority.batchNumber < releaseBatchNumber) {
          setMessage(zone.dataset.dropZone === 'tray' ? 'authority' : 'user', `Certificate locked until batch ${releaseBatchNumber}.`);
          return;
        }
      }

      const accepted = (zone.dataset.accept || '').split(',').filter(Boolean);
      if (accepted.length && !accepted.includes(sourceKind)) {
        setMessage(zone.dataset.dropZone === 'tray' ? 'user' : 'authority', `That zone only accepts ${accepted.join(', ')}.`);
        return;
      }

      if (zone.dataset.dropZone === 'tray') {
        const trayName = zone.dataset.trayName;
        if (!trayName || !state.trays[trayName]) {
          return;
        }
        if (state.trays[trayName].includes(source.id)) {
          return;
        }
        state.trays[trayName].unshift(source.id);
        persistState();
        render();
        return;
      }

      const slotName = zone.dataset.slotName;
      if (!slotName) {
        return;
      }

      const [section, name] = slotName.split('.');
      state.slots[section][name] = source.id;
      persistState();
      render();
    });
  });
}

function renderInputs() {
  authorityGroupInput.value = state.authority.groupName;
  authorityMessageInput.value = state.authority.message;
  authorityScopeInput.value = state.authority.scope;
  authorityNameInput.value = state.authority.certificateName;
  adminTokenInput.value = state.authority.adminToken;
}

function render() {
  renderInputs();

  currentBatchLabel.textContent = `Current batch: ${state.authority.batchNumber}`;
  currentRootBadge.textContent = state.authority.currentRoot && state.authority.currentRoot !== 'unknown'
    ? `root ${shortText(state.authority.currentRoot, 12)}`
    : 'root unknown';

  authorityJwtSlot.innerHTML = renderSlot('authority.jwt', 'Drop a JWT/ID here');
  authorityTokenSlot.innerHTML = renderSlot('authority.token', 'Drop a token commitment here');
  authorityCertificateTray.innerHTML = renderTray('authorityCertificates', 'Issued certificates will appear here.');

  userInventoryTray.innerHTML = renderTray('userInventory', 'Create a JWT/ID or token to start the inventory.');
  userCertificateSlot.innerHTML = renderSlot('user.certificate', 'Drop a certificate here');
  userTokenSlot.innerHTML = renderSlot('user.token', 'Drop a token here');
  verifierProofSlot.innerHTML = renderSlot('verifier.proof', 'Drop a proof here');
  verificationLog.innerHTML = renderVerificationLog();

  userInventoryCount.textContent = `${state.trays.userInventory.length} items`;

  authorityStatus.textContent = state.messages.authority || '';
  userStatus.textContent = state.messages.user || '';
  aggregationStatus.textContent = state.messages.aggregation || '';
  verifierStatus.textContent = state.messages.verifier || '';
  batchStatus.textContent = state.messages.batch || '';
}

document.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-item-id]');
  if (!card) {
    return;
  }

  const itemId = card.dataset.itemId;
  const item = getItem(itemId);
  const dragKind = event.target.closest('[data-drag-kind]')?.dataset.dragKind || item?.kind;
  if (item && item.kind === 'certificate') {
    const releaseBatchNumber = Number(item.data.releaseBatchNumber || item.data.batchNumber || 0);
    if (state.authority.batchNumber < releaseBatchNumber) {
      event.preventDefault();
      return;
    }
  }

  draggedItemId = itemId;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', itemId);
  event.dataTransfer.setData('application/x-untye-kind', dragKind || '');
  card.classList.add('is-dragging');
});

document.addEventListener('dragend', () => {
  draggedItemId = null;
  document.querySelectorAll('.item-card.is-dragging').forEach((card) => {
    card.classList.remove('is-dragging');
  });
  document.querySelectorAll('.is-over').forEach((zone) => {
    zone.classList.remove('is-over');
  });
});

authorityGroupInput.addEventListener('input', () => {
  state.authority.groupName = authorityGroupInput.value;
  persistState();
});

authorityMessageInput.addEventListener('input', () => {
  state.authority.message = authorityMessageInput.value;
  persistState();
});

authorityScopeInput.addEventListener('input', () => {
  state.authority.scope = authorityScopeInput.value;
  persistState();
});

authorityNameInput.addEventListener('input', () => {
  state.authority.certificateName = authorityNameInput.value;
  persistState();
});

adminTokenInput.addEventListener('input', () => {
  state.authority.adminToken = adminTokenInput.value;
  persistState();
});

proofNameInput.addEventListener('input', () => {
  persistState();
});

createJwtBtn.addEventListener('click', () => {
  createJwtIdItem();
});

createTokenBtn.addEventListener('click', async () => {
  try {
    setMessage('user', 'Generating a random token...');
    await createTokenItem();
  } catch (error) {
    setMessage('user', error.message);
  }
});

issueCertificateBtn.addEventListener('click', async () => {
  try {
    await issueCertificate();
  } catch (error) {
    setMessage('authority', error.message);
  }
});

nextBatchBtn.addEventListener('click', async () => {
  try {
    setMessage('batch', 'Advancing to the next batch...');
    await advanceNextBatch();
  } catch (error) {
    setMessage('batch', error.message);
  }
});

aggregateProofBtn.addEventListener('click', async () => {
  try {
    setMessage('aggregation', 'Generating proof...');
    await aggregateProof();
  } catch (error) {
    setMessage('aggregation', error.message);
  }
});

clearUserSlotsBtn.addEventListener('click', () => {
  clearSlot('user.certificate');
  clearSlot('user.token');
  setMessage('aggregation', 'User proof slots cleared.');
});

verifyProofBtn.addEventListener('click', async () => {
  try {
    setMessage('verifier', 'Verifying proof against the live authority root...');
    await verifyProof();
  } catch (error) {
    setMessage('verifier', error.message);
  }
});

clearVerifierSlotBtn.addEventListener('click', () => {
  clearSlot('verifier.proof');
  setMessage('verifier', 'Verifier slot cleared.');
});

syncAuthorityRoot().catch(() => {
  refreshRootBadge('unknown');
});

hydratePendingCertificates().catch(() => {
  setMessage('batch', 'Pending certificates will hydrate after the next batch.');
});

bindDropZones();
render();
