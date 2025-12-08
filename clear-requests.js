const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function clearRequests() {
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

        const connection = await pool.getConnection();
        console.log('Connected to database. Starting cleanup...');

        // Disable foreign key checks to allow truncation
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        const tablesToClear = [
            'requests',
            'bonafide_certificates',
            'transfer_certificates',
            'achievement_certificates',
            'noc_certificates',
            'project_completion_certificates',
            'participation_certificates'
        ];

        for (const table of tablesToClear) {
            try {
                await connection.query(`TRUNCATE TABLE ${table}`);
                console.log(`Cleared table: ${table}`);
            } catch (err) {
                console.error(`Error clearing table ${table}:`, err.message);
            }
        }

        // Re-enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Cleanup completed successfully.');
        connection.release();
        await pool.end();

    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

clearRequests();
