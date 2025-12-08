const db = require('./database');

async function createPasswordResetTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_token (token),
                INDEX idx_user_id (user_id)
            )
        `;

        await db.execute(sql);
        console.log('✅ password_reset_tokens table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating table:', err);
        process.exit(1);
    }
}

createPasswordResetTable();
