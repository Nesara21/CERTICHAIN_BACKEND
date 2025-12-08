const db = require('./database');

async function clearUsers() {
    try {
        // Disable foreign key checks
        await db.execute('SET FOREIGN_KEY_CHECKS = 0');

        // Delete all users
        await db.execute('DELETE FROM users');
        console.log('✅ All user records have been cleared from the database.');

        // Re-enable foreign key checks
        await db.execute('SET FOREIGN_KEY_CHECKS = 1');

        // Verify
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM users');
        console.log(`Remaining users: ${rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error clearing users:', err);
        process.exit(1);
    }
}

clearUsers();
