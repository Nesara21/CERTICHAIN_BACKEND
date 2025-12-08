const http = require('http');

function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    try {
        console.log('--- Starting Tests ---');

        // 1. Signup Institute
        const instUser = `inst_${Date.now()}`;
        console.log(`1. Signing up Institute: ${instUser}`);
        const r1 = await request('/api/auth/signup', 'POST', {
            username: instUser, password: 'password', role: 'institute', name: 'Test Institute'
        });
        console.log('   Response:', r1.status, r1.body);

        // 2. Login Institute
        console.log('2. Logging in Institute');
        const r2 = await request('/api/auth/login', 'POST', {
            username: instUser, password: 'password'
        });
        console.log('   Response:', r2.status);
        const instToken = r2.body.token;

        // 3. Create Template
        console.log('3. Creating Template');
        const r3 = await request('/api/institute/templates', 'POST', {
            name: 'Test Cert', description: 'A test certificate'
        }, instToken);
        console.log('   Response:', r3.status, r3.body);
        const templateId = r3.body.id;

        // 4. Signup Student
        const studUser = `stud_${Date.now()}`;
        console.log(`4. Signing up Student: ${studUser}`);
        const r4 = await request('/api/auth/signup', 'POST', {
            username: studUser, password: 'password', role: 'student', name: 'Test Student'
        });
        console.log('   Response:', r4.status, r4.body);

        // 5. Login Student
        console.log('5. Logging in Student');
        const r5 = await request('/api/auth/login', 'POST', {
            username: studUser, password: 'password'
        });
        console.log('   Response:', r5.status);
        const studToken = r5.body.token;

        // 6. Browse Templates
        console.log('6. Browsing Templates');
        const r6 = await request('/api/student/templates', 'GET', null, studToken);
        console.log('   Response:', r6.status, 'Count:', r6.body.length);

        // 7. Request Certificate
        console.log('7. Requesting Certificate');
        const r7 = await request('/api/student/requests', 'POST', {
            template_id: templateId
        }, studToken);
        console.log('   Response:', r7.status, r7.body);

        // 8. Institute Checks Requests
        console.log('8. Institute Checking Requests');
        const r8 = await request('/api/institute/requests', 'GET', null, instToken);
        console.log('   Response:', r8.status, 'Count:', r8.body.length);
        const requestId = r8.body[0].id;

        // 9. Institute Approves Request
        console.log(`9. Approving Request ${requestId}`);
        const r9 = await request(`/api/institute/requests/${requestId}`, 'PUT', {
            status: 'Approved'
        }, instToken);
        console.log('   Response:', r9.status, r9.body);

        // 10. Student Checks Status
        console.log('10. Student Checking Status');
        const r10 = await request('/api/student/requests', 'GET', null, studToken);
        console.log('   Response:', r10.status, 'Status:', r10.body[0].status);

        // 11. Download Certificate
        if (r10.body[0].status === 'Approved') {
            console.log('11. Downloading Certificate');
            const r11 = await request(`/api/student/certificate/${requestId}`, 'GET', null, studToken);
            console.log('   Response:', r11.status);

            // 12. Verify Blockchain
            console.log('12. Verifying Blockchain');
            const certHash = r10.body[0].certificate_hash;
            console.log('   Certificate Hash:', certHash);

            if (certHash) {
                const r12 = await request(`/api/verify/${certHash}`, 'GET');
                console.log('   Verification Response:', r12.status, r12.body.valid);

                if (r11.status === 200 && r12.body.valid) {
                    console.log('--- TESTS PASSED ---');
                } else {
                    console.log('--- TESTS FAILED (Download/Verify) ---');
                }
            } else {
                console.log('--- TESTS FAILED (No Hash) ---');
            }

        } else {
            console.log('--- TESTS FAILED (Status) ---');
        }

    } catch (e) {
        console.error('Test Error:', e);
    }
}

runTests();
