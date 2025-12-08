const request = require('supertest');
const app = require('../server');
const db = require('../database');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');

describe('GET /api/students/:id/certificates', () => {
    let studentToken;
    let studentId;
    let instituteId;
    let templateId;
    let requestId;

    before(async () => {
        // 1. Create a student user
        const studentRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_student_doc', 'password', 'student', 'Test Student Doc', 'test_doc@example.com']
        );
        studentId = studentRes[0].insertId;
        studentToken = jwt.sign({ id: studentId, username: 'test_student_doc', role: 'student' }, process.env.JWT_SECRET || 'supersecretkey_certichain');

        // 2. Create an institute user
        const instituteRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_institute_doc', 'password', 'institute', 'Test Institute Doc', 'test_inst_doc@example.com']
        );
        instituteId = instituteRes[0].insertId;

        // 3. Create a template
        const templateRes = await db.execute(
            `INSERT INTO templates (institute_id, name, template_type) VALUES (?, ?, ?)`,
            [instituteId, 'Test Degree', 'Degree Certificate']
        );
        templateId = templateRes[0].insertId;

        // 4. Create a request (Approved)
        const requestRes = await db.execute(
            `INSERT INTO requests (student_id, template_id, status, request_date, certificate_hash) VALUES (?, ?, ?, NOW(), ?)`,
            [studentId, templateId, 'Approved', 'hash123']
        );
        requestId = requestRes[0].insertId;
    });

    after(async () => {
        // Cleanup
        if (requestId) await db.execute('DELETE FROM requests WHERE id = ?', [requestId]);
        if (templateId) await db.execute('DELETE FROM templates WHERE id = ?', [templateId]);
        if (studentId && instituteId) await db.execute('DELETE FROM users WHERE id IN (?, ?)', [studentId, instituteId]);
        // await db.end(); // Don't close pool if other tests need it, or if app keeps running. 
        // But for standalone run, we might need to exit. 
        // Mocha usually handles exit if we don't hang.
    });

    it('should return certificates for the student', async () => {
        const res = await request(app)
            .get(`/api/students/${studentId}/certificates`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.data).to.be.an('array');
        expect(res.body.data.length).to.be.above(0);
        expect(res.body.data[0].template_name).to.equal('Test Degree');
        expect(res.body.data[0].badge).to.equal('Valid');
    });

    it('should filter by status', async () => {
        const res = await request(app)
            .get(`/api/students/${studentId}/certificates?status=Approved`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.length).to.equal(1);
    });

    it('should filter by incorrect status and return empty', async () => {
        const res = await request(app)
            .get(`/api/students/${studentId}/certificates?status=Pending`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.length).to.equal(0);
    });

    it('should search by template name', async () => {
        const res = await request(app)
            .get(`/api/students/${studentId}/certificates?search=Degree`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.length).to.equal(1);
    });

    it('should fail if accessing another student certificates', async () => {
        const res = await request(app)
            .get(`/api/students/${studentId + 999}/certificates`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(403);
    });
});
