const db = require('./database');
const bcrypt = require('bcrypt');

async function resetPasswords() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Reset for nesara
        await db.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'nesara']);
        console.log('Reset password for user: nesara');

        // Reset for SDMCET
        await db.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'SDMCET']);
        console.log('Reset password for user: SDMCET');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPasswords();
