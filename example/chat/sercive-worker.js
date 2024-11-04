const CACHE_NAME = 'v1';

// サービスワーカーのインストール
self.addEventListener('install', event => {
    console.log('サービスワーカーがインストールされました');
});

// サービスワーカーのアクティベート
self.addEventListener('activate', event => {
    console.log('サービスワーカーがアクティブになりました');
});

// WebSocket接続
self.addEventListener('message', event => {
    const { data } = event;
    if (data.type === 'subscribe') {
        // WebSocketの接続を確立する
        const ws = new WebSocket(data.url);
        
        ws.onmessage = function (messageEvent) {
            const messageData = JSON.parse(messageEvent.data);
            const from = messageData.from;
            const msg = messageData.message || 'ファイルが送信されました';
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ from, msg });
                });
            });
        };
    }
});
