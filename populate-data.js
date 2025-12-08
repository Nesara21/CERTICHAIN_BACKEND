const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Nesara21$',
    database: process.env.DB_NAME || 'certichain'
};

const students = [
    { name: 'Nesara Gouda', username: 'nesara', email: 'nesara@example.com' },
    { name: 'Vidya Pai', username: 'vidya', email: 'vidya@example.com' },
    { name: 'Saanvi Mahindrakar', username: 'saanvi', email: 'saanvi@example.com' },
    { name: 'Abhishek Shastri', username: 'abhishek', email: 'abhishek@example.com' }
];

const institute = { name: 'SDMCET', username: 'sdmcet', email: 'sdmcet@example.com' };

const certificateTypes = [
    'Bonafide Certificate',
    'Transfer Certificate',
    'Achievement Certificate',
    'NOC (No Objection Certificate)',
    'Project Completion Certificate',
    'Participation Certificate',
    'Degree Certificate'
];

async function populate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create Institute
        const hashedPassword = await bcrypt.hash('password123', 10);
        let instituteId;

        try {
            const [res] = await connection.execute(
                'INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)',
                [institute.username, hashedPassword, 'institute', institute.name, institute.email]
            );
            instituteId = res.insertId;
            console.log(`Created institute: ${institute.name}`);
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                const [rows] = await connection.execute('SELECT id FROM users WHERE username = ?', [institute.username]);
                instituteId = rows[0].id;
                console.log(`Institute ${institute.name} already exists.`);
            } else throw e;
        }

        // 2. Create Students
        const studentIds = {};
        for (const student of students) {
            try {
                const [res] = await connection.execute(
                    'INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)',
                    [student.username, hashedPassword, 'student', student.name, student.email]
                );
                studentIds[student.username] = res.insertId;
                console.log(`Created student: ${student.name}`);
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    const [rows] = await connection.execute('SELECT id FROM users WHERE username = ?', [student.username]);
                    studentIds[student.username] = rows[0].id;
                    console.log(`Student ${student.name} already exists.`);
                } else throw e;
            }
        }

        // 3. Create Templates
        const templateIds = {};
        for (const type of certificateTypes) {
            try {
                // Check if exists first (since we added duplicate check)
                const [existing] = await connection.execute(
                    'SELECT id FROM templates WHERE institute_id = ? AND template_type = ?',
                    [instituteId, type]
                );

                if (existing.length > 0) {
                    templateIds[type] = existing[0].id;
                    console.log(`Template ${type} already exists.`);
                } else {
                    const [res] = await connection.execute(
                        'INSERT INTO templates (institute_id, name, description, template_type) VALUES (?, ?, ?, ?)',
                        [instituteId, type, `Standard ${type}`, type]
                    );
                    templateIds[type] = res.insertId;
                    console.log(`Created template: ${type}`);
                }
            } catch (e) {
                console.error(`Error creating template ${type}:`, e.message);
            }
        }

        // 4. Create Requests & Certificates
        const assignments = [
            { student: 'nesara', type: 'Bonafide Certificate' },
            { student: 'nesara', type: 'Transfer Certificate' },
            { student: 'vidya', type: 'Achievement Certificate' },
            { student: 'vidya', type: 'NOC (No Objection Certificate)' },
            { student: 'saanvi', type: 'Project Completion Certificate' },
            { student: 'saanvi', type: 'Participation Certificate' },
            { student: 'abhishek', type: 'Degree Certificate' },
            { student: 'abhishek', type: 'Bonafide Certificate' }
        ];

        for (const assign of assignments) {
            const studentId = studentIds[assign.student];
            const templateId = templateIds[assign.type];
            const studentName = students.find(s => s.username === assign.student).name;

            if (!studentId || !templateId) {
                console.log(`Skipping ${assign.type} for ${assign.student} (missing ID)`);
                continue;
            }

            // Create Request
            const [reqRes] = await connection.execute(
                'INSERT INTO requests (student_id, template_id, status, request_date) VALUES (?, ?, ?, NOW())',
                [studentId, templateId, 'Approved']
            );
            const requestId = reqRes.insertId;
            const certificateHash = `hash_${requestId}_${Date.now()}`; // Dummy hash

            // Update Request with Hash
            await connection.execute(
                'UPDATE requests SET certificate_hash = ? WHERE id = ?',
                [certificateHash, requestId]
            );

            console.log(`Created request for ${assign.student}: ${assign.type}`);

            // Insert Certificate Details
            const issueDate = new Date().toISOString().split('T')[0];
            const studentUSN = `USN${studentId}2023`;
            let sql = '';
            let params = [];

            switch (assign.type) {
                case 'Bonafide Certificate':
                    sql = `INSERT INTO bonafide_certificates (request_id, student_name, student_usn, program_name, academic_year, start_date, end_date, purpose, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'B.E. CSE', '2023-2024', '2020-08-01', '2024-06-01', 'Internship Application', institute.name, issueDate];
                    break;
                case 'Transfer Certificate':
                    sql = `INSERT INTO transfer_certificates (request_id, student_name, student_usn, parent_name, program_name, start_date, end_date, conduct, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'Parent Name', 'B.E. CSE', '2020-08-01', '2024-06-01', 'Good', institute.name, issueDate];
                    break;
                case 'Achievement Certificate':
                    sql = `INSERT INTO achievement_certificates (request_id, student_name, student_usn, achievement_title, event_date, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'Best Coder 2023', '2023-11-15', institute.name, issueDate];
                    break;
                case 'NOC (No Objection Certificate)':
                    sql = `INSERT INTO noc_certificates (request_id, student_name, student_usn, admission_number, program_name, year, semester, department, organization_name, start_date, end_date, duration_days, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, `ADM${studentId}`, 'B.E. CSE', '4', '7', 'CSE', 'Google', '2024-01-01', '2024-06-01', 180, institute.name, issueDate];
                    break;
                case 'Project Completion Certificate':
                    sql = `INSERT INTO project_completion_certificates (request_id, student_name, student_usn, project_title, supervisor_name, submission_date, project_grade, program_name, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'Blockchain Cert System', 'Dr. Supervisor', '2023-12-01', 'A+', 'B.E. CSE', institute.name, issueDate];
                    break;
                case 'Participation Certificate':
                    sql = `INSERT INTO participation_certificates (request_id, student_name, student_usn, event_name, event_date, event_location, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'Hackathon 2023', '2023-10-10', 'Bangalore', institute.name, issueDate];
                    break;
                case 'Degree Certificate':
                    sql = `INSERT INTO degree_certificates (request_id, student_name, student_usn, program_name, academic_year, start_date, end_date, institute_name, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    params = [requestId, studentName, studentUSN, 'Bachelor of Engineering', '2020-2024', '2020-08-01', '2024-06-01', institute.name, issueDate];
                    break;
            }

            if (sql) {
                await connection.execute(sql, params);
                console.log(`Inserted details for ${assign.type}`);
            }
        }

        console.log('Database population complete!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) connection.end();
    }
}

populate();
