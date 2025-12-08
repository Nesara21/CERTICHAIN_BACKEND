const db = require('./database');

async function checkTables() {
    try {
        const [rows] = await db.execute('SHOW TABLES');
        console.log('Tables in database:');
        rows.forEach(row => {
            console.log(Object.values(row)[0]);
        });

        const tables = [
            'bonafide_certificates',
            'transfer_certificates',
            'achievement_certificates',
            'noc_certificates',
            'project_completion_certificates',
            'participation_certificates'
        ];

        for (const table of tables) {
            const [columns] = await db.execute(`DESCRIBE ${table}`);
            console.log(`\nColumns in ${table}:`);
            columns.forEach(col => {
                console.log(`  ${col.Field} (${col.Type})`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTables();
