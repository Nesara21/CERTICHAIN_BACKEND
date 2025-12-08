const db = require('./database');

async function fixRole() {
    try {
        await db.execute("UPDATE users SET role = 'institute' WHERE username = 'sdm'");
        console.log("Updated role for 'sdm' to 'institute'");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixRole();
