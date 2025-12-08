const db = require('./database');

async function checkTableCounts() {
    const tables = [
        'bonafide_certificates',
        'transfer_certificates',
        'achievement_certificates',
        'noc_certificates',
        'project_completion_certificates',
        'participation_certificates'
    ];

    try {
        console.log('Checking row counts...');
        for (const table of tables) {
            const [rows] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`${table}: ${rows[0].count} rows`);
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking counts:', err);
        process.exit(1);
    }
}

checkTableCounts();
