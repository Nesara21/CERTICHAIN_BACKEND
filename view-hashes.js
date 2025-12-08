const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function viewHashes() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'certichain',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const [rows] = await pool.execute('SELECT id, student_id, certificate_hash, status FROM requests WHERE certificate_hash IS NOT NULL');

        console.log('--- Generated Certificate Hashes ---');
        if (rows.length === 0) {
            console.log('No hashes found.');
        } else {
            rows.forEach(row => {
                console.log(`ID: ${row.id} | Student ID: ${row.student_id} | Status: ${row.status}`);
                console.log(`Hash: ${row.certificate_hash}`);
                console.log('-----------------------------------');
            });
        }

        await pool.end();
    } catch (err) {
        console.error('Error fetching hashes:', err);
    }
}

viewHashes();
