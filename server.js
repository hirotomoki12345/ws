const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const PORT = 5210;

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

const window = new JSDOM('').window;
const purify = DOMPurify(window);

wss.on('connection', (ws) => {
    console.log('新しいクライアントが接続しました');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.id) {
            clients[data.id] = ws;
            console.log(`クライアントID: ${data.id} が接続しました`);
        }
        if (data.to && data.message) {
            const sanitizedMessage = purify.sanitize(data.message);
            const targetClient = clients[data.to];
            if (targetClient) {
                targetClient.send(JSON.stringify({ from: data.id, message: sanitizedMessage }));
                console.log(`メッセージを送信しました: from=${data.id}, to=${data.to}, message=${sanitizedMessage}`);
            } else {
                console.log(`ターゲットクライアントが見つかりません: ${data.to}`);
            }
        }
    });

    ws.on('close', () => {
        console.log('クライアントが切断されました');
        for (const id in clients) {
            if (clients[id] === ws) {
                console.log(`クライアントID: ${id} が切断されました`);
                delete clients[id];
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`WebSocketサーバーがポート ${PORT} で起動しました`);
});
