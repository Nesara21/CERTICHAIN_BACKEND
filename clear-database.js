const db = require('./database');

async function clearDatabase() {
    console.log('Starting database cleanup...\n');

    try {
        // Disable foreign key checks to avoid constraint errors
        await db.execute('SET FOREIGN_KEY_CHECKS = 0');
        console.log('✓ Foreign key checks disabled\n');

        // List of all tables to clear
        const tables = [
            'bonafide_certificates',
            'transfer_certificates',
            'achievement_certificates',
            'noc_certificates',
            'project_completion_certificates',
            'participation_certificates',
            'requests',
            'templates',
            'users'
        ];

        console.log('Clearing tables:');
        console.log('─'.repeat(50));

        for (const table of tables) {
            try {
                await db.execute(`TRUNCATE TABLE ${table}`);
                console.log(`✓ Cleared: ${table}`);
            } catch (err) {
                console.log(`✗ Error clearing ${table}: ${err.message}`);
            }
        }

        // Re-enable foreign key checks
        await db.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('\n✓ Foreign key checks re-enabled');

        console.log('\n' + '='.repeat(50));
        console.log('✓ Database cleanup complete!');
        console.log('All tables have been cleared.');
        console.log('='.repeat(50));

        process.exit(0);
    } catch (err) {
        console.error('\n✗ Error during database cleanup:', err);
        process.exit(1);
    }
}

clearDatabase();
