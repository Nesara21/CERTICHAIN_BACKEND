const db = require('./database');

async function clearCertificateTables() {
    const tables = [
        'bonafide_certificates',
        'transfer_certificates',
        'achievement_certificates',
        'noc_certificates',
        'project_completion_certificates',
        'participation_certificates'
    ];

    try {
        console.log('Disabling foreign key checks...');
        await db.execute('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            console.log(`Clearing table: ${table}...`);
            await db.execute(`TRUNCATE TABLE ${table}`);
        }

        console.log('Re-enabling foreign key checks...');
        await db.execute('SET FOREIGN_KEY_CHECKS = 1');

        console.log('All certificate tables cleared successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing tables:', err);
        process.exit(1);
    }
}

clearCertificateTables();
