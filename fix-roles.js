const db = require('./database');

async function fixRoles() {
    try {
        // First, let's see all users
        const [allUsers] = await db.execute('SELECT id, username, email, role FROM users');
        console.log('All Users Before Fix:');
        console.table(allUsers);

        // Update SDMCET to institute role (assuming this is an institute account)
        console.log('\nUpdating SDMCET to institute role...');
        await db.execute('UPDATE users SET role = ? WHERE username = ?', ['institute', 'SDMCET']);

        // Show updated users
        const [updatedUsers] = await db.execute('SELECT id, username, email, role FROM users');
        console.log('\nAll Users After Fix:');
        console.table(updatedUsers);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixRoles();
