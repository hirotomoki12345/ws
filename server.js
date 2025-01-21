const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const PORT = 5210;

const app = express();
app.use(cors());

// リクエストレートリミットの設定
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1分間
    max: 100, // 最大リクエスト数
    message: 'リクエストの制限を超えました。しばらく待ってから再試行してください。'
});
app.use(limiter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// クライアントを管理するためのMap
const clients = new Map();

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// クライアント履歴を保存するファイルパス
const CLIENTS_FILE_PATH = path.join(__dirname, 'clients.txt');

// クライアント履歴ファイルがあれば読み込む
let clientHistory = {};
if (fs.existsSync(CLIENTS_FILE_PATH)) {
    const rawData = fs.readFileSync(CLIENTS_FILE_PATH, 'utf-8');
    clientHistory = JSON.parse(rawData);
}

// データ検証用ヘルパー関数
const isValidJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

// WebSocketサーバーのイベント設定
wss.on('connection', (ws) => {
    console.log('新しいクライアントが接続しました');

    // メッセージ受信時の処理
    ws.on('message', (message) => {
        if (!isValidJSON(message)) {
            console.warn('不正なJSONデータを受信しました');
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
            return;
        }

        const data = JSON.parse(message);

        // クライアントIDの登録
        if (data.id) {
            if (typeof data.id !== 'string' || data.id.trim() === '') {
                console.warn('不正なクライアントIDを受信しました');
                ws.send(JSON.stringify({ error: 'Invalid client ID' }));
                return;
            }

            clients.set(data.id, ws);
            console.log(`クライアントID: ${data.id} が接続しました`);
        }

        // メッセージ送信処理
        if (data.to && data.message) {
            const sanitizedMessage = purify.sanitize(data.message);
            const timestamp = new Date().toISOString();

            // 通信履歴を更新
            if (!clientHistory[data.id]) {
                clientHistory[data.id] = [];
            }
            clientHistory[data.id].push({ date: timestamp, content: sanitizedMessage });

            // 履歴をファイルに保存
            fs.writeFileSync(CLIENTS_FILE_PATH, JSON.stringify(clientHistory, null, 2));

            const targetClient = clients.get(data.to);
            if (targetClient) {
                try {
                    targetClient.send(JSON.stringify({
                        from: data.id,
                        message: sanitizedMessage,
                        timestamp: timestamp
                    }));
                    console.log(`メッセージ送信成功: from=${data.id}, to=${data.to}`);
                } catch (err) {
                    console.error('メッセージ送信中にエラーが発生しました:', err);
                }
            } else {
                console.warn(`送信先クライアントが見つかりません: ${data.to}`);
            }
        }

        // ファイル送信処理
        if (data.to && data.file) {
            const timestamp = new Date().toISOString();

            // 通信履歴を更新
            if (!clientHistory[data.id]) {
                clientHistory[data.id] = [];
            }
            clientHistory[data.id].push({ date: timestamp, content: `File: ${data.file.name}` });

            // 履歴をファイルに保存
            fs.writeFileSync(CLIENTS_FILE_PATH, JSON.stringify(clientHistory, null, 2));

            const targetClient = clients.get(data.to);
            if (targetClient) {
                try {
                    targetClient.send(JSON.stringify({
                        from: data.id,
                        file: data.file,
                        timestamp: timestamp
                    }));
                    console.log(`ファイル送信成功: from=${data.id}, to=${data.to}`);
                } catch (err) {
                    console.error('ファイル送信中にエラーが発生しました:', err);
                }
            } else {
                console.warn(`送信先クライアントが見つかりません: ${data.to}`);
            }
        }
    });

    // クライアント切断時の処理
    ws.on('close', () => {
        console.log('クライアントが切断されました');
        for (const [id, clientWs] of clients.entries()) {
            if (clientWs === ws) {
                console.log(`クライアントID: ${id} が切断されました`);
                clients.delete(id);
                break;
            }
        }
    });

    // エラーハンドリング
    ws.on('error', (err) => {
        console.error('WebSocketエラー:', err);
    });
});

// /all エンドポイントの追加
app.get('/all', (req, res) => {
    res.json(clientHistory);
});

// /ids エンドポイントの追加
app.get('/ids', (req, res) => {
    const ids = Object.keys(clientHistory);
    res.json({ ids });
});

// サーバー起動
server.listen(PORT, () => {
    console.log(`WebSocketサーバーがポート ${PORT} で起動しました`);
});
