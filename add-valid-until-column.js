const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Nesara21$',
    database: process.env.DB_NAME || 'certichain'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        try {
            await connection.execute('ALTER TABLE requests ADD COLUMN valid_until DATETIME');
            console.log('Added valid_until column to requests table.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column valid_until already exists.');
            } else {
                throw e;
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) connection.end();
    }
}

migrate();
