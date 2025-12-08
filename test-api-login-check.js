const fetch = require('node-fetch');

async function testLogin() {
    const users = ['sdmcet', 'nesara'];

    for (const username of users) {
        try {
            const response = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: 'password123' })
            });

            const data = await response.json();
            console.log(`Login for ${username}:`, response.status === 200 ? 'SUCCESS' : 'FAILED', data);
        } catch (error) {
            console.error(`Error logging in ${username}:`, error.message);
        }
    }
}

testLogin();
