const db = require('./database');

async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('Successfully connected to MySQL!');

        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('Test query result:', rows[0].result);

        connection.release();
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

testConnection();
