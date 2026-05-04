const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

const app = express();
const PORT = process.env.PORT || 3001;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const JSONBIN_API_URL = 'https://api.jsonbin.io/v3';
const groupMessages = {};

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
  }

  try {
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...req.body,
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
      }),
    });

    const data = await groqResponse.json();
    return res.status(groqResponse.status).json(data);
  } catch (error) {
    console.error('Groq proxy request failed:', error);
    return res.status(500).json({ error: 'Failed to contact Groq API' });
  }
});

function requireJsonbinConfig(res) {
  if (!process.env.JSONBIN_API_KEY) {
    res.status(500).json({ error: 'JSONBIN_API_KEY is not configured' });
    return false;
  }
  if (!process.env.JSONBIN_INDEX_BIN_ID) {
    res.status(500).json({ error: 'JSONBIN_INDEX_BIN_ID is not configured' });
    return false;
  }
  return true;
}

async function jsonbinRequest(path, options = {}) {
  const response = await fetch(`${JSONBIN_API_URL}${path}`, {
    ...options,
    headers: {
      'X-Master-Key': process.env.JSONBIN_API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.error || `JSONBin request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function readBin(binId) {
  const data = await jsonbinRequest(`/b/${binId}/latest`, {
    method: 'GET',
    headers: { 'X-Bin-Meta': 'false' },
  });
  return data?.record || data;
}

async function updateBin(binId, record) {
  await jsonbinRequest(`/b/${binId}`, {
    method: 'PUT',
    headers: { 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(record),
  });
  return record;
}

async function createBin(record, name) {
  const headers = { 'X-Bin-Name': name, 'X-Bin-Private': 'true' };
  if (process.env.JSONBIN_COLLECTION_ID) headers['X-Collection-Id'] = process.env.JSONBIN_COLLECTION_ID;
  const data = await jsonbinRequest('/b', {
    method: 'POST',
    headers,
    body: JSON.stringify(record),
  });
  return data?.metadata?.id || data?.record || data?.id;
}

function normalizeGroup(record) {
  return {
    code: String(record?.code || '').toUpperCase(),
    members: Array.isArray(record?.members) ? record.members : [],
    sharedNotes: Array.isArray(record?.sharedNotes) ? record.sharedNotes : [],
    sharedFiles: Array.isArray(record?.sharedFiles) ? record.sharedFiles : [],
    messages: Array.isArray(record?.messages) ? record.messages : [],
  };
}

function normalizeMessage(message) {
  const id = String(message?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const text = String(message?.text || '').trim().slice(0, 2000);
  return {
    id,
    senderId: String(message?.senderId || '').trim().slice(0, 120),
    senderName: String(message?.senderName || 'Scholar').trim().slice(0, 80) || 'Scholar',
    text,
    timestamp: Number(message?.timestamp || Date.now()),
  };
}

function ensureGroupMessageStore(code, fallbackMessages = []) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return [];
  if (!Array.isArray(groupMessages[normalizedCode])) {
    const seeded = Array.isArray(fallbackMessages) ? fallbackMessages.map(normalizeMessage) : [];
    groupMessages[normalizedCode] = seeded.slice(-300);
  }
  return groupMessages[normalizedCode];
}

function getGroupMessages(code, fallbackMessages = []) {
  return ensureGroupMessageStore(code, fallbackMessages).slice();
}

function addGroupMessage(code, message, fallbackMessages = []) {
  const messages = ensureGroupMessageStore(code, fallbackMessages);
  const normalized = normalizeMessage(message);
  const existingIndex = messages.findIndex(item => item.id === normalized.id);
  if (existingIndex >= 0) messages[existingIndex] = normalized;
  else messages.push(normalized);
  if (messages.length > 300) messages.splice(0, messages.length - 300);
  groupMessages[String(code || '').trim().toUpperCase()] = messages;
  return normalized;
}

function attachGroupMessages(group) {
  const code = String(group?.code || '').trim().toUpperCase();
  return {
    ...group,
    messages: getGroupMessages(code, group?.messages || []),
  };
}

function normalizeIndex(record) {
  return { groups: record && typeof record.groups === 'object' && !Array.isArray(record.groups) ? record.groups : {} };
}

function buildMember(body) {
  return {
    id: String(body.deviceId || '').trim(),
    name: String(body.name || 'Scholar').trim().slice(0, 80) || 'Scholar',
    color: String(body.avatarColor || '#7B3FA0').trim().slice(0, 24),
    joinedAt: Date.now(),
  };
}

function addOrUpdateMember(group, member) {
  if (!member.id) throw new Error('Missing device ID');
  const existing = group.members.find(m => m.id === member.id);
  if (existing) {
    existing.name = member.name;
    existing.color = member.color;
    existing.lastSeen = Date.now();
  } else {
    group.members.push(member);
  }
}

async function getGroupBinId(code) {
  const index = normalizeIndex(await readBin(process.env.JSONBIN_INDEX_BIN_ID));
  return { index, binId: index.groups[code] };
}

app.post('/api/study-groups', async (req, res) => {
  if (!requireJsonbinConfig(res)) return;
  try {
    const member = buildMember(req.body || {});
    let index = normalizeIndex(await readBin(process.env.JSONBIN_INDEX_BIN_ID));
    let code = '';
    for (let i = 0; i < 10; i++) {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
      if (!index.groups[code]) break;
    }
    if (!code || index.groups[code]) return res.status(409).json({ error: 'Could not generate a unique group code' });

    const group = normalizeGroup({ code, members: [member], sharedNotes: [], sharedFiles: [], messages: [] });
    const binId = await createBin(group, `ScholarAI-${code}`);
    ensureGroupMessageStore(code, group.messages);
    index.groups[code] = binId;
    await updateBin(process.env.JSONBIN_INDEX_BIN_ID, index);
    res.json({ ...attachGroupMessages(group), binId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/study-groups/join', async (req, res) => {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Invalid group code' });
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    const group = normalizeGroup(await readBin(binId));
    addOrUpdateMember(group, buildMember(req.body || {}));
    await updateBin(binId, group);
    res.json({ ...attachGroupMessages(group), binId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/study-groups/:code', async (req, res) => {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    res.json({ ...attachGroupMessages(normalizeGroup(await readBin(binId))), binId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/study-groups/:code/shared-notes', async (req, res) => {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    const group = normalizeGroup(await readBin(binId));
    const note = {
      id: String(req.body?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      title: String(req.body?.title || 'Untitled note').slice(0, 160),
      content: String(req.body?.content || ''),
      subject: String(req.body?.subject || 'General').slice(0, 120),
      sharerName: String(req.body?.sharerName || 'Scholar').slice(0, 80),
      sharedAt: Date.now(),
    };
    if (!group.sharedNotes.some(n => n.id === note.id)) group.sharedNotes.unshift(note);
    await updateBin(binId, group);
    res.json({ ...attachGroupMessages(group), binId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/study-groups/:code/shared-files', async (req, res) => {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    const group = normalizeGroup(await readBin(binId));
    const file = {
      id: String(req.body?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name: String(req.body?.name || 'Shared file').slice(0, 180),
      type: String(req.body?.type || 'application/octet-stream').slice(0, 120),
      subject: String(req.body?.subject || 'General').slice(0, 120),
      base64: String(req.body?.base64 || ''),
      size: Number(req.body?.size || 0),
      sharerName: String(req.body?.sharerName || 'Scholar').slice(0, 80),
      sharedAt: Date.now(),
    };
    if (!file.base64) return res.status(400).json({ error: 'Missing file data' });
    if (!group.sharedFiles.some(f => f.id === file.id)) group.sharedFiles.unshift(file);
    await updateBin(binId, group);
    res.json({ ...attachGroupMessages(group), binId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function readGroupMessagesHandler(req, res) {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    const group = normalizeGroup(await readBin(binId));
    res.json({ messages: getGroupMessages(code, group.messages) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function writeGroupMessagesHandler(req, res) {
  if (!requireJsonbinConfig(res)) return;
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { binId } = await getGroupBinId(code);
    if (!binId) return res.status(404).json({ error: 'Group code not found' });
    const group = normalizeGroup(await readBin(binId));
    const message = normalizeMessage(req.body || {});
    if (!message.senderId) return res.status(400).json({ error: 'Missing sender ID' });
    if (!message.text) return res.status(400).json({ error: 'Missing message text' });
    addGroupMessage(code, message, group.messages);
    res.json({ message, messages: getGroupMessages(code, group.messages) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

app.get('/api/group/:code/messages', readGroupMessagesHandler);
app.post('/api/group/:code/messages', writeGroupMessagesHandler);
app.get('/api/study-groups/:code/messages', readGroupMessagesHandler);
app.post('/api/study-groups/:code/messages', writeGroupMessagesHandler);

app.listen(PORT, () => {
  console.log(`ScholarAI proxy server running on port ${PORT}`);
});
