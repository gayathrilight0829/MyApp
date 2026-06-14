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
        console.log("Login Status:", res.statusCode);
        console.log("Login Body:", body);
        
        const data = JSON.parse(body);
        if (data.token) {
            fetchUserData(data.token);
        }
    });
});

reqLogin.on('error', (e) => {
    console.error(`Login error: ${e.message}`);
});

reqLogin.write(loginData);
reqLogin.end();

function fetchUserData(token) {
    const reqData = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/userdata',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log("Fetch Userdata Status:", res.statusCode);
            console.log("Fetch Userdata Body length:", body.length);
        });
    });

    reqData.on('error', (e) => {
        console.error(`Fetch userdata error: ${e.message}`);
    });

    reqData.end();
}
