const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));

let clients = [];
let mergedNotes = [];

function mergeNotes(newNotes) {
  const byId = Object.fromEntries(mergedNotes.map(n => [n.id, n]));
  for (const note of newNotes) {
    byId[note.id] = note;
  }
  mergedNotes = Object.values(byId);
}

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log(`Client connected (${clients.length} total)`);

  ws.send(JSON.stringify({ type: 'sync', data: mergedNotes }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'upload') {
        mergeNotes(parsed.data);

        const syncMsg = JSON.stringify({ type: 'sync', data: mergedNotes });
        const logMsg = JSON.stringify({ type: 'upload-log', data: parsed.data });

        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(syncMsg);
            client.send(logMsg);
          }
        }

        console.log(`Received ${parsed.data.length} note(s) from a client.`);
      }
    } catch (e) {
      console.error('Failed to parse incoming message:', msg);
    }
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    console.log(`Client disconnected (${clients.length} remaining)`);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
