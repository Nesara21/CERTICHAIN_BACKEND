const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise')
const jwt = require('jsonwebtoken');
// const db = require('./database');
const QRCode = require('qrcode');
const { Blockchain, Block } = require('./blockchain');
require('dotenv').config();

const app = express();
const PORT = 5001;
const HOST = '0.0.0.0'; // Listen on all network interfaces
const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey_certichain';
const QR_BASE_URL = process.env.QR_BASE_URL || null;


// --- Reliability Imports ---
const { logger, requestLogger } = require('./lib/logger');
const { idempotency } = require('./lib/idempotency');
const { blockchainQueue } = require('./lib/blockchainQueue');
const { generatePdfBuffer } = require('./services/pdf');
const { uploadToS3 } = require('./services/s3');
const crypto = require('crypto'); // For SHA256




const db = mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    port:process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// Initialize Blockchain Queue only if RPC_URL and PRIVATE_KEY are provided
if (process.env.RPC_URL && process.env.PRIVATE_KEY) {
    try {
        blockchainQueue.init(process.env.RPC_URL, process.env.PRIVATE_KEY);
    } catch (e) {
        console.warn('Blockchain queue initialization failed:', e.message);
    }
};

// Initialize Blockchain (Legacy - keeping for now if needed, but we use queue for real chain)
const certichain = new Blockchain();

app.use(cors());
app.use(express.json());
app.use(requestLogger); // Add logging middleware

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Username and password '+username+"--"+password)
    const sql = `SELECT * FROM users WHERE username = ?`;
    try {
        const [rows] = await db.execute(sql, [username]);
        const user = rows[0];

        if (!user) return res.status(400).json({ error: 'User not found' });

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, SECRET_KEY);
            
            res.json({ token, role: user.role, name: user.name, id: user.id, usn: user.name });
        } else {
            res.status(400).json({ error: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
const dbquery = "use railway"
const dbTable = 'show tables'

app.get('/show-db', async (req, res) => {
    try {
        await db.query("USE railway");
        const [rows] = await db.query("SHOW TABLES");
        res.json(rows);
    } catch (err) {
        res.json({ status: err.message });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, password, role, email } = req.body;

    console.log('Signup request received:', { username, password: '***', role, email });

    if (!username || !password || !role || !email) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const params = [username, hashedPassword, role, null, email];

        const sql = `INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, params);
        res.json({ id: result.insertId, message: 'User created successfully' });
    } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Signup failed: ' + err.message });
    }
});

// --- PASSWORD RESET ROUTES ---

const emailService = require('./lib/emailService');

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Find user by email
        const sql = 'SELECT id, username, email, name FROM users WHERE email = ?';
        const [rows] = await db.execute(sql, [email]);

        if (rows.length === 0) {
            // Don't reveal if email exists or not for security
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const user = rows[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // Store token in database
        const insertSql = 'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
        await db.execute(insertSql, [user.id, hashedToken, expiresAt]);

        // Send email
        const emailResult = await emailService.sendPasswordResetEmail(
            user.email,
            resetToken,
            user.name || user.username
        );

        if (emailResult.success) {
            console.log(`✅ Password reset email sent to ${email}`);
            console.log(`   Preview: ${emailResult.previewUrl}`);

            res.json({
                message: 'If an account with that email exists, a password reset link has been sent.',
                // Include preview URL in development
                ...(process.env.NODE_ENV !== 'production' && { previewUrl: emailResult.previewUrl })
            });
        } else {
            throw new Error('Failed to send email');
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Verify reset token
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const sql = `
            SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = ? AND prt.used = FALSE
        `;

        const [rows] = await db.execute(sql, [hashedToken]);

        if (rows.length === 0) {
            return res.status(400).json({ valid: false, error: 'Invalid or expired reset token' });
        }

        const tokenData = rows[0];
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);

        if (now > expiresAt) {
            return res.status(400).json({ valid: false, error: 'Reset token has expired' });
        }

        res.json({ valid: true, email: tokenData.email });
    } catch (err) {
        console.error('Verify token error:', err);
        res.status(500).json({ valid: false, error: 'Failed to verify token' });
    }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Verify token
        const sql = `
            SELECT prt.id, prt.user_id, prt.expires_at, prt.used
            FROM password_reset_tokens prt
            WHERE prt.token = ? AND prt.used = FALSE
        `;

        const [rows] = await db.execute(sql, [hashedToken]);

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or already used reset token' });
        }

        const tokenData = rows[0];
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);

        if (now > expiresAt) {
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const updatePasswordSql = 'UPDATE users SET password = ? WHERE id = ?';
        await db.execute(updatePasswordSql, [hashedPassword, tokenData.user_id]);

        // Mark token as used
        const markUsedSql = 'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?';
        await db.execute(markUsedSql, [tokenData.id]);

        console.log(`✅ Password reset successful for user ID: ${tokenData.user_id}`);
        res.json({ message: 'Password has been reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// --- INSTITUTE ROUTES ---

// Get all templates for the logged-in institute
app.get('/api/institute/templates', authenticateToken, async (req, res) => {
    if (req.user.role !== 'institute') return res.sendStatus(403);

    const sql = `SELECT * FROM templates WHERE institute_id = ?`;
    try {
        const [rows] = await db.execute(sql, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new template
app.post('/api/institute/templates', authenticateToken, async (req, res) => {
    if (req.user.role !== 'institute') return res.sendStatus(403);
    const { template_type } = req.body;

    // Validate template_type is provided
    if (!template_type) {
        return res.status(400).json({ error: 'Template type is required' });
    }

    // Auto-generate name from template_type
    const name = template_type;

    try {
        // Check for duplicate template_type (one type per institute)
        const checkSql = `SELECT id FROM templates WHERE institute_id = ? AND template_type = ?`;
        const [existing] = await db.execute(checkSql, [req.user.id, template_type]);

        if (existing.length > 0) {
            return res.status(400).json({ error: `You already have a ${template_type} template. Each institute can only create one template per type.` });
        }

        const sql = `INSERT INTO templates (institute_id, name, description, template_type) VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [req.user.id, name, null, template_type]);
        res.json({ id: result.insertId, name, template_type });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get requests for the institute
app.get('/api/institute/requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'institute') return res.sendStatus(403);

    const sql = `
    SELECT r.id, r.status, r.request_date, u.username as student_name, t.name as template_name, t.template_type
    FROM requests r
    JOIN templates t ON r.template_id = t.id
    JOIN users u ON r.student_id = u.id
    WHERE t.institute_id = ?
    ORDER BY 
        CASE 
            WHEN r.status = 'Approved' THEN 0
            WHEN r.status = 'Pending' THEN 1
            WHEN r.status = 'Rejected' THEN 2
        END,
        r.request_date DESC
  `;
    try {
        const [rows] = await db.execute(sql, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Analytics Dashboard Data
app.get('/api/institute/analytics', authenticateToken, async (req, res) => {
    if (req.user.role !== 'institute') return res.sendStatus(403);

    try {
        // 1. Total Issued (Approved requests for this institute)
        const issuedSql = `
            SELECT COUNT(*) as count 
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            WHERE t.institute_id = ? AND r.status = 'Approved'
        `;
        const [issuedRows] = await db.execute(issuedSql, [req.user.id]);
        const totalIssued = issuedRows[0].count;

        // 2. Total Pending
        const pendingSql = `
            SELECT COUNT(*) as count 
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            WHERE t.institute_id = ? AND r.status = 'Pending'
        `;
        const [pendingRows] = await db.execute(pendingSql, [req.user.id]);
        const totalPending = pendingRows[0].count;

        // 3. Total Downloads
        const downloadsSql = `
            SELECT SUM(r.download_count) as count 
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            WHERE t.institute_id = ?
        `;
        const [downloadsRows] = await db.execute(downloadsSql, [req.user.id]);
        const totalDownloads = Number(downloadsRows[0].count) || 0;

        // 4. Verification Success Rate (Global for now, or filtered by institute certificates if possible)
        // Since verification logs store hash, we need to join to check if the hash belongs to this institute
        const verificationSql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN vl.is_valid = 1 THEN 1 ELSE 0 END) as success
            FROM verification_logs vl
            JOIN requests r ON vl.certificate_hash = r.certificate_hash
            JOIN templates t ON r.template_id = t.id
            WHERE t.institute_id = ?
        `;
        const [verificationRows] = await db.execute(verificationSql, [req.user.id]);
        const totalVerifications = verificationRows[0].total;
        const successfulVerifications = verificationRows[0].success;
        const verificationRate = totalVerifications > 0
            ? Math.round((successfulVerifications / totalVerifications) * 100)
            : 0;

        // 5. Popular Certificates
        const popularSql = `
            SELECT t.template_type, COUNT(*) as count
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            WHERE t.institute_id = ? AND r.status = 'Approved'
            GROUP BY t.template_type
            ORDER BY count DESC
            LIMIT 5
        `;
        const [popularRows] = await db.execute(popularSql, [req.user.id]);

        res.json({
            totalIssued,
            totalPending,
            totalDownloads,
            verificationRate,
            popularCertificates: popularRows
        });

    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});


// Approve/Reject request - RELIABILITY REFACTOR
app.put('/api/institute/requests/:id', authenticateToken, idempotency, async (req, res) => {
    if (req.user.role !== 'institute') return res.sendStatus(403);
    const { status } = req.body; // 'Approved' or 'Rejected'
    const requestId = req.params.id;

    // Verify the request belongs to a template owned by this institute
    const verifySql = `
    SELECT r.id, r.student_id, r.template_id, r.request_date, t.template_type, 
           u.name as student_name, u.username as student_username, u.email as student_email,
           i.name as institute_name, i.username as institute_username
    FROM requests r
    JOIN templates t ON r.template_id = t.id
    JOIN users u ON r.student_id = u.id
    JOIN users i ON t.institute_id = i.id
    WHERE r.id = ? AND t.institute_id = ?
  `;

    try {
        const [rows] = await db.execute(verifySql, [requestId, req.user.id]);
        const row = rows[0];

        if (!row) return res.status(404).json({ error: 'Request not found or unauthorized' });

        // Helper to log status event
        const logStatusEvent = async (status, description) => {
            await db.execute(
                'INSERT INTO status_events (request_id, status, description) VALUES (?, ?, ?)',
                [Number(requestId), status, description]
            );
        };

        let certificateHash = null;
        let pdfUrl = null;
        let txHash = null;

        if (status === 'Approved') {
            // 1. Prepare Certificate Details
            const issueDate = new Date().toISOString().split('T')[0];
            const studentUSN = `USN${row.student_id}${Date.now().toString().slice(-6)}`;
            let certificateDetails = {};

            // Helper to get details based on type
            const getDetails = (type) => {
                const common = {
                    request_id: requestId,
                    student_name: row.student_name || row.student_username,
                    student_usn: studentUSN,
                    institute_name: row.institute_name || row.institute_username,
                    issue_date: issueDate
                };
                switch (type) {
                    case 'Degree Certificate': return { ...common, program_name: 'B.Tech', academic_year: '2023-24', start_date: '2020-08-01', end_date: '2024-06-30' };
                    case 'Bonafide Certificate': return { ...common, program_name: 'B.Tech', academic_year: '2023-24', start_date: '2020-08-01', end_date: '2024-06-30', purpose: 'Official' };
                    case 'Transfer Certificate': return { ...common, parent_name: 'Parent', program_name: 'B.Tech', start_date: '2020-08-01', end_date: '2024-06-30', conduct: 'Good' };
                    case 'Achievement Certificate': return { ...common, achievement_title: 'Achievement', event_date: issueDate };
                    case 'NOC (No Objection Certificate)': return { ...common, admission_number: studentUSN, program_name: 'B.Tech', year: '3', semester: '6', department: 'CS', organization_name: 'Org', start_date: issueDate, end_date: issueDate, duration_days: 30 };
                    case 'Project Completion Certificate': return { ...common, project_title: 'Project', supervisor_name: 'Sup', submission_date: issueDate, project_grade: 'A', program_name: 'B.Tech' };
                    case 'Participation Certificate': return { ...common, event_name: 'Event', event_date: issueDate, event_location: 'Institute Campus' };
                    default: return common;
                }
            };

            certificateDetails = getDetails(row.template_type);

            // Insert details into specific table
            let detailsTable = '';
            switch (row.template_type) {
                case 'Degree Certificate': detailsTable = 'degree_certificates'; break;
                case 'Bonafide Certificate': detailsTable = 'bonafide_certificates'; break;
                case 'Transfer Certificate': detailsTable = 'transfer_certificates'; break;
                case 'Achievement Certificate': detailsTable = 'achievement_certificates'; break;
                case 'NOC (No Objection Certificate)': detailsTable = 'noc_certificates'; break;
                case 'Project Completion Certificate': detailsTable = 'project_completion_certificates'; break;
                case 'Participation Certificate': detailsTable = 'participation_certificates'; break;
            }

            if (detailsTable) {
                const keys = Object.keys(certificateDetails);
                const values = Object.values(certificateDetails);
                const placeholders = keys.map(() => '?').join(',');
                const sql = `INSERT INTO ${detailsTable} (${keys.join(',')}) VALUES (${placeholders})`;
                await db.execute(sql, values);
            }

            // 2. Generate PDF (Deterministic)
            const pdfBuffer = await generatePdfBuffer(row.template_type, certificateDetails);

            // 3. Upload to S3 (Optional - skip if not configured)
            if (process.env.AWS_S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
                try {
                    const s3Key = `certificates/${requestId}.pdf`;
                    pdfUrl = await uploadToS3(pdfBuffer, s3Key);
                    req.log.info(`PDF uploaded to S3: ${pdfUrl}`);
                } catch (s3Err) {
                    req.log.warn(`S3 upload failed (continuing without it): ${s3Err.message}`);
                    pdfUrl = `local://certificates/${requestId}.pdf`;
                }
                pdfUrl = `local://certificates/${requestId}.pdf`;
            }

            // Email: Generating
            const studentEmail = row.student_email || row.student_username + '@example.com';
            await logStatusEvent('Generating', 'Certificate generation started');
            emailService.sendStatusUpdateEmail(studentEmail, 'Generating', row.student_name);

            // 4. Calculate Hash
            certificateHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
            req.log.info(`Generated Hash: ${certificateHash}`);

            // 5. Publish to Blockchain (Optional - skip if not configured)
            if (process.env.RPC_URL && process.env.PRIVATE_KEY) {
                try {
                    const receipt = await blockchainQueue.add(async () => {
                        return {
                            to: process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
                            value: 0,
                            data: '0x' + certificateHash
                        };
                    });
                    txHash = receipt.hash;
                    req.log.info(`Blockchain TX confirmed: ${txHash}`);
                } catch (bcErr) {
                    req.log.warn(`Blockchain publication failed (continuing without it): ${bcErr.message}`);
                    txHash = 'pending';
                }
            } else {
                req.log.info('Blockchain not configured, skipping on-chain publication');
                txHash = 'not_published';
            }
        }

        // 6. Update Request Status
        const updateSql = `UPDATE requests SET status = ?, certificate_hash = ? WHERE id = ?`;
        await db.execute(updateSql, [status, certificateHash, requestId]);

        // Post-response actions (Async)
        if (status === 'Approved') {

            const studentEmail = row.student_email || row.student_username + '@example.com';

            // Email: Approved
            await logStatusEvent('Approved', 'Request approved by institute');

            await emailService.sendStatusUpdateEmail(studentEmail, 'Approved', row.student_name);

            // Email: Ready (after generation)
            const downloadLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/documents`;
            await logStatusEvent('Ready', 'Certificate ready for download');

            await emailService.sendStatusUpdateEmail(studentEmail, 'Ready', row.student_name, { downloadLink });
        } else if (status === 'Rejected') {
            const studentEmail = row.student_email || row.student_username + '@example.com';
            await logStatusEvent('Rejected', 'Request rejected by institute');
            emailService.sendStatusUpdateEmail(studentEmail, 'Rejected', row.student_name, { reason: 'Institute decision' });
        }

        res.json({
            message: 'Request updated',
            hash: certificateHash,
            pdfUrl: pdfUrl,
            txHash: txHash
        });

    } catch (err) {
        req.log.error(`Error updating request: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// --- STUDENT ROUTES ---

// Get all available templates (from all institutes)
app.get('/api/student/templates', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);

    const sql = `SELECT t.id, t.name, t.description, t.template_type, u.username as institute_name 
               FROM templates t 
               JOIN users u ON t.institute_id = u.id`;
    try {
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a request
app.post('/api/student/requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const { template_id } = req.body;

    const sql = `INSERT INTO requests (student_id, template_id) VALUES (?, ?)`;
    try {
        const [result] = await db.execute(sql, [req.user.id, template_id]);

        // Log event
        await db.execute(
            'INSERT INTO status_events (request_id, status, description) VALUES (?, ?, ?)',
            [result.insertId, 'Submitted', 'Request submitted by student']
        );

        // Send email
        // Fetch student details to get email
        const userSql = 'SELECT email, name FROM users WHERE id = ?';
        const [userRows] = await db.execute(userSql, [req.user.id]);

        if (userRows.length > 0) {
            const userEmail = userRows[0].email;
            const userName = userRows[0].name || req.user.username;
            emailService.sendStatusUpdateEmail(userEmail, 'Submitted', userName);
        } else {
            console.warn(`Could not find email for user ID ${req.user.id}`);
        }

        res.json({ id: result.insertId, message: 'Request submitted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get my requests
app.get('/api/student/requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);

    const sql = `
    SELECT r.id, r.status, r.request_date, t.name as template_name, t.template_type, u.username as institute_name, r.certificate_hash
    FROM requests r
    JOIN templates t ON r.template_id = t.id
    JOIN users u ON t.institute_id = u.id
    WHERE r.student_id = ?
    ORDER BY 
        CASE 
            WHEN r.status IN ('Approved', 'Rejected') THEN 0
            WHEN r.status = 'Pending' THEN 1
        END,
        r.request_date DESC
  `;
    try {
        const [rows] = await db.execute(sql, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get request status history
app.get('/api/requests/:id/history', authenticateToken, async (req, res) => {
    const requestId = req.params.id;

    // Security check: ensure user owns the request or is the institute
    const checkSql = `
        SELECT r.student_id, t.institute_id 
        FROM requests r 
        JOIN templates t ON r.template_id = t.id 
        WHERE r.id = ?
    `;

    try {
        const [checkRows] = await db.execute(checkSql, [requestId]);
        if (checkRows.length === 0) return res.status(404).json({ error: 'Request not found' });

        const request = checkRows[0];
        if (req.user.role === 'student' && request.student_id !== req.user.id) return res.sendStatus(403);
        if (req.user.role === 'institute' && request.institute_id !== req.user.id) return res.sendStatus(403);

        const historySql = `SELECT status, description, created_at FROM status_events WHERE request_id = ? ORDER BY created_at ASC`;
        const [historyRows] = await db.execute(historySql, [requestId]);

        res.json(historyRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get student certificates with pagination, filtering, and search
app.get('/api/students/:id/certificates', authenticateToken, async (req, res) => {
    // Ensure the user is requesting their own certificates or is an admin (if we had admins)
    // For now, strict check: logged in user must match the requested ID
    if (parseInt(req.params.id) !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized access to these documents' });
    }

    const studentId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const type = req.query.type; // Filter by certificate type
    const status = req.query.status; // Filter by status
    const search = req.query.search; // Search by template name or institute name

    let queryParams = [studentId];
    let whereClause = 'WHERE r.student_id = ?';

    if (type && type !== 'All') {
        whereClause += ' AND t.template_type = ?';
        queryParams.push(type);
    }

    if (status && status !== 'All') {
        whereClause += ' AND r.status = ?';
        queryParams.push(status);
    }

    if (search) {
        whereClause += ' AND (t.name LIKE ? OR u.username LIKE ? OR t.template_type LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Count total for pagination
    const countSql = `
        SELECT COUNT(*) as total
        FROM requests r
        JOIN templates t ON r.template_id = t.id
        JOIN users u ON t.institute_id = u.id
        ${whereClause}
    `;

    // Fetch data
    const sql = `
        SELECT r.id, r.status, r.request_date, r.certificate_hash,
               t.name as template_name, t.template_type, t.description,
               u.username as institute_name, u.name as institute_full_name
        FROM requests r
        JOIN templates t ON r.template_id = t.id
        JOIN users u ON t.institute_id = u.id
        ${whereClause}
        ORDER BY r.request_date DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    try {
        const [countRows] = await db.execute(countSql, queryParams);
        const totalItems = countRows[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        const [rows] = await db.execute(sql, queryParams);

        // Enhance rows with derived data
        const enhancedRows = rows.map(row => ({
            ...row,
            pdfUrl: row.certificate_hash ? `/api/student/certificate/${row.id}` : null, // Reusing existing endpoint logic for download
            verificationUrl: row.certificate_hash ? `/verify/${row.certificate_hash}` : null,
            badge: row.status === 'Approved' ? 'Valid' : (row.status === 'Rejected' ? 'Revoked' : 'Pending') // Simple mapping for now
        }));

        res.json({
            data: enhancedRows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit
            }
        });
    } catch (err) {
        console.error('Error fetching student documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// Download Certificate - Fetch real data from certificate tables
app.get('/api/student/certificate/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const requestId = req.params.id;

    try {
        // First get the basic request info
        const requestSql = `
            SELECT r.id, r.status, r.request_date, u.name as student_name, u.username as student_username, u.id as student_id,
            t.name as template_name, t.description, t.template_type,
            i.name as institute_name, r.certificate_hash
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            JOIN users u ON r.student_id = u.id
            JOIN users i ON t.institute_id = i.id
            WHERE r.id = ? AND r.student_id = ? AND r.status = 'Approved'
            `;

        const [requestRows] = await db.execute(requestSql, [requestId, req.user.id]);

        if (requestRows.length === 0) {
            return res.status(404).json({ error: 'Certificate not found or not approved' });
        }

        const certData = requestRows[0];

        // Fetch certificate-specific details based on template_type
        let detailsSql = '';
        let detailsTable = '';

        switch (certData.template_type) {
            case 'Degree Certificate':
                detailsTable = 'degree_certificates';
                break;
            case 'Bonafide Certificate':
                detailsTable = 'bonafide_certificates';
                break;
            case 'Transfer Certificate':
                detailsTable = 'transfer_certificates';
                break;
            case 'Achievement Certificate':
                detailsTable = 'achievement_certificates';
                break;
            case 'NOC (No Objection Certificate)':
                detailsTable = 'noc_certificates';
                break;
            case 'Project Completion Certificate':
                detailsTable = 'project_completion_certificates';
                break;
            case 'Participation Certificate':
                detailsTable = 'participation_certificates';
                break;
            default:
                return res.status(400).json({ error: 'Unknown certificate type' });
        }

        detailsSql = `SELECT * FROM ${detailsTable} WHERE request_id = ? `;
        const [detailsRows] = await db.execute(detailsSql, [requestId]);

        if (detailsRows.length === 0) {
            return res.status(404).json({ error: 'Certificate details not found. Please contact the institute.' });
        }

        // Validate that student name in certificate matches the logged-in user's name
        const certificateStudentName = detailsRows[0].student_name;
        const userAccountName = certData.student_name || certData.student_username; // Fallback to username

        if (certificateStudentName && userAccountName &&
            certificateStudentName.toLowerCase().trim() !== userAccountName.toLowerCase().trim()) {
            return res.status(400).json({
                error: `Name mismatch! Certificate name "${certificateStudentName}" does not match your account name "${userAccountName}".Please contact the institute to update the certificate details.`
            });
        }

        // Merge request data with certificate details
        const fullCertData = {
            ...certData,
            ...detailsRows[0]
        };

        // Increment download count
        await db.execute('UPDATE requests SET download_count = download_count + 1 WHERE id = ?', [requestId]);

        res.json(fullCertData);
    } catch (err) {
        console.error('Error fetching certificate:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generate QR Code for a verification URL
app.get('/api/qrcode/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;

        // Use environment variable if set (for mobile access), otherwise use request host
        const baseUrl = QR_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const verificationUrl = `${baseUrl}/verify/${hash}`;

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
            width: 150,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.json({ qrCodeDataUrl });
    } catch (err) {
        console.error('QR Code generation error:', err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Verify Certificate
app.get('/api/verify/:hash', async (req, res) => {
    const hash = req.params.hash;

    // Check Database First (Primary Source of Truth)
    const sql = `
        SELECT r.id, r.request_date, r.valid_until,
               COALESCE(u.name, u.username) as student_name, 
               t.name as template_name, 
               t.template_type, 
               COALESCE(i.name, i.username) as institute_name
        FROM requests r
        JOIN templates t ON r.template_id = t.id
        JOIN users u ON r.student_id = u.id
        JOIN users i ON t.institute_id = i.id
        WHERE r.certificate_hash = ?
    `;

    try {
        const [rows] = await db.execute(sql, [hash]);
        const row = rows[0];

        if (row) {
            // Certificate found in DB - It is VALID
            // Log verification success
            await db.execute(
                'INSERT INTO verification_logs (certificate_hash, is_valid, user_agent) VALUES (?, ?, ?)',
                [hash, true, req.headers['user-agent'] || 'Unknown']
            );

            // Optionally try to get blockchain info, but don't fail if missing (since in-memory chain clears on restart)
            const block = certichain.getBlockByHash(hash);

            res.json({
                valid: true,
                data: row,
                block: block || { hash: 'Not in local memory', previousHash: '...', timestamp: row.request_date }
            });
        } else {
            // Log verification failure
            await db.execute(
                'INSERT INTO verification_logs (certificate_hash, is_valid, user_agent) VALUES (?, ?, ?)',
                [hash, false, req.headers['user-agent'] || 'Unknown']
            );

            res.json({ valid: false, error: 'Certificate not found in database' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/',(req,res)=>{
    console.log("API running successfully")
    res.json({status:"running successfully"})
});

if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Network access: http://${HOST}:${PORT}`);
        if (QR_BASE_URL) {
            console.log(`QR codes will use: ${QR_BASE_URL}`);
        }
    });
}




// Export app for testing
module.exports = app;
