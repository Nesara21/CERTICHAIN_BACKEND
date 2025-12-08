const request = require('supertest');
const app = require('../server');
const db = require('../database');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');

describe('GET /api/institute/analytics', () => {
    let instituteToken;
    let instituteId;
    let studentId;
    let templateId;
    let requestId;

    before(async () => {
        // 1. Create an institute user
        const instituteRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_inst_analytics', 'password', 'institute', 'Test Institute Analytics', 'test_inst_ana@example.com']
        );
        instituteId = instituteRes[0].insertId;
        instituteToken = jwt.sign({ id: instituteId, username: 'test_inst_analytics', role: 'institute' }, process.env.JWT_SECRET || 'supersecretkey_certichain');

        // 2. Create a student user
        const studentRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_student_ana', 'password', 'student', 'Test Student Analytics', 'test_stu_ana@example.com']
        );
        studentId = studentRes[0].insertId;

        // 3. Create a template
        const templateRes = await db.execute(
            `INSERT INTO templates (institute_id, name, template_type) VALUES (?, ?, ?)`,
            [instituteId, 'Analytics Degree', 'Degree Certificate']
        );
        templateId = templateRes[0].insertId;

        // 4. Create a request (Approved)
        const requestRes = await db.execute(
            `INSERT INTO requests (student_id, template_id, status, request_date, certificate_hash, download_count) VALUES (?, ?, ?, NOW(), ?, ?)`,
            [studentId, templateId, 'Approved', 'hash_analytics', 5]
        );
        requestId = requestRes[0].insertId;

        // 5. Create verification logs
        await db.execute(
            `INSERT INTO verification_logs (certificate_hash, is_valid) VALUES (?, ?)`,
            ['hash_analytics', true]
        );
        await db.execute(
            `INSERT INTO verification_logs (certificate_hash, is_valid) VALUES (?, ?)`,
            ['hash_analytics', false]
        );
    });

    after(async () => {
        // Cleanup
        if (requestId) await db.execute('DELETE FROM requests WHERE id = ?', [requestId]);
        if (templateId) await db.execute('DELETE FROM templates WHERE id = ?', [templateId]);
        if (studentId && instituteId) await db.execute('DELETE FROM users WHERE id IN (?, ?)', [studentId, instituteId]);
        await db.execute('DELETE FROM verification_logs WHERE certificate_hash = ?', ['hash_analytics']);
    });

    it('should return analytics data', async () => {
        const res = await request(app)
            .get('/api/institute/analytics')
            .set('Authorization', `Bearer ${instituteToken}`);

        if (res.status !== 200) {
            console.log('Response Status:', res.status);
            console.log('Response Body:', JSON.stringify(res.body, null, 2));
        }

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('totalIssued');
        if (res.body.totalIssued !== 1) {
            console.log('Total Issued mismatch. Body:', JSON.stringify(res.body, null, 2));
        }
        expect(res.body.totalIssued).to.equal(1);

        expect(res.body).to.have.property('totalDownloads');
        expect(res.body.totalDownloads).to.equal(5); // Initial 5

        expect(res.body).to.have.property('verificationRate');
        // 1 success out of 2 total = 50%
        expect(res.body.verificationRate).to.equal(50);

        expect(res.body).to.have.property('popularCertificates');
        expect(res.body.popularCertificates).to.be.an('array');
        expect(res.body.popularCertificates[0].template_type).to.equal('Degree Certificate');
    });

    it('should fail for non-institute users', async () => {
        const studentToken = jwt.sign({ id: studentId, role: 'student' }, process.env.JWT_SECRET || 'supersecretkey_certichain');
        const res = await request(app)
            .get('/api/institute/analytics')
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(403);
    });
});
