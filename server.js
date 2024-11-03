const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const sanitizer = require('sanitizer');
const fs = require('fs');

const PORT = 5210;
const CLIENT_ID_FILE = 'client_ids.txt';

const app = express();
app.use(cors());

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'リクエストの制限を超えました。しばらく待ってから再試行してください。'
});

app.use(limiter);
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = {};

function saveClientIds() {
    fs.writeFileSync(CLIENT_ID_FILE, JSON.stringify(Object.keys(clients)), 'utf-8');
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.id) {
            clients[data.id] = ws;
            saveClientIds();
        }
        if (data.to && data.message) {
            const targetClient = clients[data.to];
            const sanitizedMessage = sanitizer.sanitize(data.message);
            if (targetClient) {
                targetClient.send(JSON.stringify({ from: data.id, message: sanitizedMessage }));
            }
        }
    });

    ws.on('close', () => {
        for (const id in clients) {
            if (clients[id] === ws) {
                delete clients[id];
                saveClientIds();
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`WebSocketサーバーがポート ${PORT} で起動しました`);
});
