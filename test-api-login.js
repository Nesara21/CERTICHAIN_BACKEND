// Test script to simulate login API call
const fetch = require('node-fetch');

async function testLoginAPI() {
    try {
        const response = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'SDMCET',
                password: 'password123' // Replace with actual password
            })
        });

        const data = await response.json();

        console.log('=== LOGIN API RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
        console.log('\n=== ROLE CHECK ===');
        console.log('Role value:', data.role);
        console.log('Role type:', typeof data.role);
        console.log('Is institute?', data.role === 'institute');
        console.log('Role comparison (strict):', data.role === 'institute' ? '✅ PASS' : '❌ FAIL');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testLoginAPI();
