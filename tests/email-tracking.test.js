process.env.RPC_URL = ''; // Disable blockchain for this test
const request = require('supertest');
const app = require('../server');
const db = require('../database');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const sinon = require('sinon');
const emailService = require('../lib/emailService');

describe('Email Status Tracking', () => {
    let studentToken, instituteToken;
    let studentId, instituteId, templateId, requestId;
    let emailSpy;

    before(async () => {
        // Spy on emailService.sendStatusUpdateEmail
        emailSpy = sinon.spy(emailService, 'sendStatusUpdateEmail');

        // 1. Create Institute
        const instRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_inst_email', 'password', 'institute', 'Test Institute Email', 'inst_email@test.com']
        );
        instituteId = instRes[0].insertId;
        instituteToken = jwt.sign({ id: instituteId, role: 'institute', username: 'test_inst_email' }, process.env.JWT_SECRET || 'supersecretkey_certichain');

        // 2. Create Student
        const stuRes = await db.execute(
            `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`,
            ['test_stu_email', 'password', 'student', 'Test Student Email', 'stu_email@test.com']
        );
        studentId = stuRes[0].insertId;
        studentToken = jwt.sign({ id: studentId, role: 'student', username: 'test_stu_email', email: 'stu_email@test.com' }, process.env.JWT_SECRET || 'supersecretkey_certichain');

        // 3. Create Template
        const tempRes = await db.execute(
            `INSERT INTO templates (institute_id, name, template_type) VALUES (?, ?, ?)`,
            [instituteId, 'Email Test Cert', 'Degree Certificate']
        );
        templateId = tempRes[0].insertId;
    });

    after(async () => {
        emailSpy.restore();
        // Cleanup
        if (requestId) {
            await db.execute('DELETE FROM status_events WHERE request_id = ?', [requestId]);
            await db.execute('DELETE FROM requests WHERE id = ?', [requestId]);
        }
        if (templateId) await db.execute('DELETE FROM templates WHERE id = ?', [templateId]);
        if (studentId && instituteId) await db.execute('DELETE FROM users WHERE id IN (?, ?)', [studentId, instituteId]);
    });

    it('should trigger email and log event on request submission', async () => {
        const res = await request(app)
            .post('/api/student/requests')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ template_id: templateId });

        expect(res.status).to.equal(200);
        requestId = res.body.id;

        // Check Email Trigger
        expect(emailSpy.calledWith(sinon.match.string, 'Submitted', sinon.match.string)).to.be.true;

        // Check Status Log
        const [rows] = await db.execute('SELECT * FROM status_events WHERE request_id = ? AND status = ?', [requestId, 'Submitted']);
        expect(rows.length).to.equal(1);
    });

    it('should trigger emails and log events on approval', async () => {
        const res = await request(app)
            .put(`/api/institute/requests/${requestId}`)
            .set('Authorization', `Bearer ${instituteToken}`)
            .send({ status: 'Approved' });

        expect(res.status).to.equal(200);

        // Check Email Triggers (Approved, Ready)
        // Note: server.js calls Approved, then Ready.
        try {
            expect(emailSpy.calledWith(sinon.match.string, 'Approved', sinon.match.any)).to.be.true;
            expect(emailSpy.calledWith(sinon.match.string, 'Ready', sinon.match.any)).to.be.true;
        } catch (e) {
            console.log('DEBUG: emailSpy.args:', JSON.stringify(emailSpy.args, null, 2));
            throw e;
        }

        // Check Status Logs
        const [rows] = await db.execute('SELECT * FROM status_events WHERE request_id = ?', [requestId]);
        const statuses = rows.map(r => r.status);
        expect(statuses).to.include('Approved');
        expect(statuses).to.include('Ready');
    });

    it('should return status history via API', async () => {
        const res = await request(app)
            .get(`/api/requests/${requestId}/history`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
        const statuses = res.body.map(r => r.status);
        expect(statuses).to.include('Submitted');
        expect(statuses).to.include('Approved');
    });
});
