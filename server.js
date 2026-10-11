const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const STATE_FILE = process.env.STATE_FILE || '/data/state.json';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── Persistence ──────────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load state:', e.message);
  }
  return null;
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e.message);
  }
}

let state = loadState();
console.log(state ? 'Loaded existing state from disk.' : 'No saved state found, starting fresh.');

// ── Static files ─────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ── WebSocket ─────────────────────────────────────────────────────

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === 1) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  const ip = ws._socket.remoteAddress;
  console.log(`Client connected (${ip}) — ${wss.clients.size} total`);

  // Send current state to the new client immediately
  if (state) {
    ws.send(JSON.stringify({ type: 'state', payload: state }));
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'state') {
        state = msg.payload;
        saveState(state);
        // Broadcast to everyone else so all phones update live
        broadcast({ type: 'state', payload: state }, ws);
      }
    } catch (e) {
      console.error('Bad message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected — ${wss.clients.size} remaining`);
  });

  ws.on('error', (e) => {
    console.error('WebSocket error:', e.message);
  });
});

// ── Start ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Pandemic tracker running on http://localhost:${PORT}`);
});
