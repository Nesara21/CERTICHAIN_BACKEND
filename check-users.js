const db = require('./database');

async function checkUsers() {
    try {
        const [rows] = await db.execute('SELECT id, username, email, role FROM users ORDER BY id DESC LIMIT 5');
        console.log('Recent Users:');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
