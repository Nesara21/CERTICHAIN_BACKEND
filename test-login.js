const bcrypt = require('bcrypt');
const db = require('./database');

async function testLogin() {
    try {
        const username = 'SDMCET';

        // Fetch user from database
        const sql = `SELECT * FROM users WHERE username = ?`;
        const [rows] = await db.execute(sql, [username]);
        const user = rows[0];

        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log('✅ User found in database:');
        console.log({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            name: user.name
        });

        console.log('\n📋 Login Response Data (what frontend receives):');
        console.log({
            role: user.role,
            name: user.name,
            id: user.id
        });

        console.log('\n🔍 Role Check:');
        console.log(`Expected role: 'institute'`);
        console.log(`Actual role: '${user.role}'`);
        console.log(`Match: ${user.role === 'institute' ? '✅ YES' : '❌ NO'}`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testLogin();
