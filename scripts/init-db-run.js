const { initDatabase } = require('../database');

async function run() {
    try {
        await initDatabase();
        console.log('Database initialized successfully');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
