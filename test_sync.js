const http = require('http');

const loginData = JSON.stringify({
    username: 'gayathrilight',
    password: 'mukesh'
});

const reqLogin = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        const data = JSON.parse(body);
        if (data.token) {
            syncUserData(data.token);
        }
    });
});

reqLogin.write(loginData);
reqLogin.end();

function syncUserData(token) {
    const syncPayload = JSON.stringify({
        progress: { dsa: 20, ai: 10, apti: 20, systemdesign: 5, tech: 25, core: 30 },
        logs: [
            { id: 123456, date: '2026-06-14', category: 'dsa', duration: 2.5, description: 'Practice recursion', percentageIncrement: 5 }
        ],
        events: [
            { id: 987654, date: '2026-06-15', time: '10:00', title: 'Mock Test', type: 'test' }
        ],
        resources: [],
        todos: [],
        mockTests: []
    });

    const reqSync = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/sync',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(syncPayload),
            'Authorization': `Bearer ${token}`
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log("Sync Status:", res.statusCode);
            console.log("Sync Body:", body);
        });
    });

    reqSync.write(syncPayload);
    reqSync.end();
}
