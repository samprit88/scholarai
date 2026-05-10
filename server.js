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

// ══════════════════════════════════════════════════════════
// IN-MEMORY STUDY GROUP STORAGE
// ══════════════════════════════════════════════════════════
const groups = {};

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

// ══════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ══════════════════════════════════════════════════════════
// GROQ AI PROXY
// ══════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════
// STUDY GROUP ROUTES — ALL IN-MEMORY, INSTANT
// ══════════════════════════════════════════════════════════

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/group/create — create a new group
app.post('/api/group/create', (req, res) => {
  try {
    let code = '';
    for (let i = 0; i < 20; i++) {
      code = generateCode();
      if (!groups[code]) break;
    }
    if (groups[code]) return res.status(409).json({ error: 'Could not generate unique code' });

    const group = {
      code,
      members: [],
      messages: [],
      sharedNotes: [],
      sharedFiles: []
    };

    groups[code] = group;
    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/group/join — join an existing group
app.post('/api/group/join', (req, res) => {
  try {
    const { code, memberName, memberId, memberColor } = req.body || {};
    const normalizedCode = String(code || '').trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Invalid group code' });
    }

    const group = groups[normalizedCode];
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!memberId) return res.status(400).json({ error: 'Missing memberId' });

    const existing = group.members.find(m => m.id === String(memberId).trim());
    if (existing) {
      existing.name = String(memberName || 'Scholar').trim().slice(0, 80);
      existing.color = String(memberColor || existing.color).trim().slice(0, 24);
      existing.lastSeen = Date.now();
    } else {
      group.members.push({
        id: String(memberId).trim(),
        name: String(memberName || 'Scholar').trim().slice(0, 80),
        color: String(memberColor || '#7B3FA0').trim().slice(0, 24),
        joinedAt: Date.now()
      });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/group/:code — get full group data
app.get('/api/group/:code', (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const group = groups[code];
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/group/:code/message — send a chat message
app.post('/api/group/:code/message', (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const group = groups[code];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { senderId, senderName, text, timestamp } = req.body || {};
    if (!senderId) return res.status(400).json({ error: 'Missing senderId' });
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'Missing message text' });

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: String(senderId).trim().slice(0, 120),
      senderName: String(senderName || 'Scholar').trim().slice(0, 80),
      text: String(text).trim().slice(0, 2000),
      timestamp: Number(timestamp || Date.now())
    };

    group.messages.push(message);
    // Keep last 300 messages
    if (group.messages.length > 300) group.messages.splice(0, group.messages.length - 300);

    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/group/:code/share-note — share a note to group
app.post('/api/group/:code/share-note', (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const group = groups[code];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const note = {
      id: String(req.body?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      title: String(req.body?.title || 'Untitled note').slice(0, 160),
      content: String(req.body?.content || ''),
      subject: String(req.body?.subject || 'General').slice(0, 120),
      sharerName: String(req.body?.sharerName || 'Scholar').slice(0, 80),
      sharedAt: Date.now()
    };

    if (!group.sharedNotes.some(n => n.id === note.id)) {
      group.sharedNotes.unshift(note);
    }

    res.json({ success: true, group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/group/:code/share-file — share a file to group
app.post('/api/group/:code/share-file', (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const group = groups[code];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const file = {
      id: String(req.body?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name: String(req.body?.name || 'Shared file').slice(0, 180),
      type: String(req.body?.type || 'application/octet-stream').slice(0, 120),
      subject: String(req.body?.subject || 'General').slice(0, 120),
      base64: String(req.body?.base64 || ''),
      size: Number(req.body?.size || 0),
      sharerName: String(req.body?.sharerName || 'Scholar').slice(0, 80),
      sharedAt: Date.now()
    };

    if (!file.base64) return res.status(400).json({ error: 'Missing file data' });
    if (!group.sharedFiles.some(f => f.id === file.id)) {
      group.sharedFiles.unshift(file);
    }

    res.json({ success: true, group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`ScholarAI proxy server running on port ${PORT}`);
});
