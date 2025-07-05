const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const html = fs.readFileSync('index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
});

const wss = new WebSocket.Server({ server });
let clients = [];

let mergedNotes = [];

function mergeNotes(newNotes) {
  const byId = Object.fromEntries(mergedNotes.map(n => [n.id, n]));
  for (const note of newNotes) {
    byId[note.id] = note; // replace or add
  }
  mergedNotes = Object.values(byId);
}

wss.on('connection', (ws) => {
  clients.push(ws);

  console.log(`Client connected (${clients.length} total)`);

  // Send current notes
  ws.send(JSON.stringify({ type: 'sync', data: mergedNotes }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'upload') {
        mergeNotes(parsed.data);

        // Broadcast sync and upload-log to all clients
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
  console.log(`Server running at http://localhost:${PORT}`);
});
