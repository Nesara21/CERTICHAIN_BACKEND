const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Nesara21$',
        database: process.env.DB_NAME || 'certichain'
    });

    try {
        console.log('Connected to database...');

        // Disable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        console.log('Disabled foreign key checks');

        // Clear all certificate detail tables
        const certificateTables = [
            'degree_certificates',
            'bonafide_certificates',
            'transfer_certificates',
            'achievement_certificates',
            'noc_certificates',
            'project_completion_certificates',
            'participation_certificates'
        ];

        for (const table of certificateTables) {
            await connection.execute(`TRUNCATE TABLE ${table}`);
            console.log(`Cleared ${table}`);
        }

        // Clear requests table
        await connection.execute('TRUNCATE TABLE requests');
        console.log('Cleared requests table');

        // Clear templates table
        await connection.execute('TRUNCATE TABLE templates');
        console.log('Cleared templates table');

        // Clear idempotency_keys table
        await connection.execute('TRUNCATE TABLE idempotency_keys');
        console.log('Cleared idempotency_keys table');

        // Clear users table (login details)
        await connection.execute('TRUNCATE TABLE users');
        console.log('Cleared users table (all login details removed)');

        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Re-enabled foreign key checks');

        console.log('\n✅ All login details and related data cleared successfully!');

    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        await connection.end();
        console.log('Database connection closed');
    }
}

clearDatabase();
