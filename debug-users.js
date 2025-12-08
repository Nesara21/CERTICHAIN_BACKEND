const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Nesara21$',
    database: process.env.DB_NAME || 'certichain'
};

async function checkUsers() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const [users] = await connection.execute('SELECT id, username, password, role FROM users');
        console.log(`Found ${users.length} users:`);

        for (const user of users) {
            const isMatch = await bcrypt.compare('password123', user.password);
            console.log(`- ${user.username} (${user.role}): Password 'password123' match? ${isMatch ? 'YES' : 'NO'}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) connection.end();
    }
}

checkUsers();
