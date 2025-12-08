const db = require('./database');

async function populateCertificateDetails() {
    console.log('Starting to populate certificate details for approved requests...\n');

    try {
        // Get all approved requests with their details
        const [approvedRequests] = await db.execute(`
            SELECT r.id, r.student_id, r.template_id, r.request_date, 
                   t.template_type, u.name as student_name, i.name as institute_name
            FROM requests r
            JOIN templates t ON r.template_id = t.id
            JOIN users u ON r.student_id = u.id
            JOIN users i ON t.institute_id = i.id
            WHERE r.status = 'Approved'
        `);

        console.log(`Found ${approvedRequests.length} approved requests.\n`);

        let processed = 0;
        let skipped = 0;
        let inserted = 0;

        for (const req of approvedRequests) {
            const requestId = req.id;
            const studentName = req.student_name;
            const instituteName = req.institute_name;
            const templateType = req.template_type;
            const issueDate = new Date(req.request_date).toISOString().split('T')[0];
            const studentUSN = `USN${req.student_id}${Date.now().toString().slice(-6)}`;

            processed++;
            console.log(`[${processed}/${approvedRequests.length}] Processing Request ID ${requestId} (${templateType})...`);

            try {
                switch (templateType) {
                    case 'Bonafide Certificate':
                        // Check if already exists
                        const [existingBonafide] = await db.execute(
                            'SELECT id FROM bonafide_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingBonafide.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO bonafide_certificates 
                            (request_id, student_name, student_usn, program_name, academic_year, start_date, end_date, purpose, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Bachelor of Technology', '2023-2024', '2020-08-01', '2024-06-30', 'Official Purpose', instituteName, issueDate]);
                        console.log(`  ✓ Created bonafide certificate details.\n`);
                        inserted++;
                        break;

                    case 'Transfer Certificate':
                        const [existingTransfer] = await db.execute(
                            'SELECT id FROM transfer_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingTransfer.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO transfer_certificates 
                            (request_id, student_name, student_usn, parent_name, program_name, start_date, end_date, conduct, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Parent Name', 'Bachelor of Technology', '2020-08-01', '2024-06-30', 'Good', instituteName, issueDate]);
                        console.log(`  ✓ Created transfer certificate details.\n`);
                        inserted++;
                        break;

                    case 'Achievement Certificate':
                        const [existingAchievement] = await db.execute(
                            'SELECT id FROM achievement_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingAchievement.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO achievement_certificates 
                            (request_id, student_name, student_usn, achievement_title, event_date, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Outstanding Achievement', issueDate, instituteName, issueDate]);
                        console.log(`  ✓ Created achievement certificate details.\n`);
                        inserted++;
                        break;

                    case 'NOC (No Objection Certificate)':
                        const [existingNOC] = await db.execute(
                            'SELECT id FROM noc_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingNOC.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO noc_certificates 
                            (request_id, student_name, admission_number, program_name, year, semester, department, organization_name, start_date, end_date, duration_days, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Bachelor of Technology', '3rd Year', '6th Sem', 'Computer Science', 'Tech Company', issueDate, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 90, instituteName, issueDate]);
                        console.log(`  ✓ Created NOC certificate details.\n`);
                        inserted++;
                        break;

                    case 'Project Completion Certificate':
                        const [existingProject] = await db.execute(
                            'SELECT id FROM project_completion_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingProject.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO project_completion_certificates 
                            (request_id, student_name, student_usn, project_title, supervisor_name, submission_date, project_grade, program_name, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Final Year Project', 'Dr. Supervisor Name', issueDate, 'A', 'Bachelor of Technology', instituteName, issueDate]);
                        console.log(`  ✓ Created project completion certificate details.\n`);
                        inserted++;
                        break;

                    case 'Participation Certificate':
                        const [existingParticipation] = await db.execute(
                            'SELECT id FROM participation_certificates WHERE request_id = ?',
                            [requestId]
                        );
                        if (existingParticipation.length > 0) {
                            console.log(`  ✓ Already has details, skipping.\n`);
                            skipped++;
                            break;
                        }

                        await db.execute(`
                            INSERT INTO participation_certificates 
                            (request_id, student_name, student_usn, event_name, event_date, event_location, institute_name, issue_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [requestId, studentName, studentUSN, 'Technical Workshop', issueDate, instituteName, instituteName, issueDate]);
                        console.log(`  ✓ Created participation certificate details.\n`);
                        inserted++;
                        break;

                    default:
                        console.log(`  ⚠ Unknown certificate type: ${templateType}, skipping.\n`);
                        skipped++;
                        break;
                }
            } catch (err) {
                console.error(`  ✗ Error processing request ${requestId}:`, err.message, '\n');
            }
        }

        console.log('='.repeat(50));
        console.log('Summary:');
        console.log(`  Total processed: ${processed}`);
        console.log(`  Inserted: ${inserted}`);
        console.log(`  Skipped: ${skipped}`);
        console.log('='.repeat(50));
        console.log('\n✓ Certificate details population complete!');

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

populateCertificateDetails();
