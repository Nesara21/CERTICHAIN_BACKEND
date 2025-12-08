const db = require('./database');

async function addMissingColumns() {
    console.log('Checking and adding missing student_usn columns to certificate tables...\n');

    try {
        // List of tables to check
        const tables = [
            'degree_certificates',
            'bonafide_certificates',
            'transfer_certificates',
            'achievement_certificates',
            'noc_certificates',
            'project_completion_certificates',
            'participation_certificates'
        ];

        for (const table of tables) {
            try {
                // Check if the column exists
                const [columns] = await db.execute(`SHOW COLUMNS FROM ${table} LIKE 'student_usn'`);

                if (columns.length === 0) {
                    // Column doesn't exist, add it
                    console.log(`Adding student_usn column to ${table}...`);
                    await db.execute(`ALTER TABLE ${table} ADD COLUMN student_usn VARCHAR(100) NOT NULL AFTER student_name`);
                    console.log(`✓ Added student_usn to ${table}`);
                } else {
                    console.log(`✓ ${table} already has student_usn column`);
                }
            } catch (err) {
                console.error(`Error processing ${table}:`, err.message);
            }
        }

        console.log('\n✅ All tables checked and updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

addMissingColumns();
