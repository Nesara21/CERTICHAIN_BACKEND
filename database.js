const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Nesara21$',
  database: process.env.DB_NAME || 'certichain',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to the MySQL database.');

    // Users table
    await connection.execute(`CREATE TABLE IF NOT EXISTS users(
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('student', 'institute') NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL
    )`);

    // Templates table
    await connection.execute(`CREATE TABLE IF NOT EXISTS templates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      institute_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      template_type VARCHAR(255) DEFAULT 'Degree Certificate',
      FOREIGN KEY(institute_id) REFERENCES users(id)
    )`);

    // Requests table
    await connection.execute(`CREATE TABLE IF NOT EXISTS requests(
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT,
      template_id INT,
      status VARCHAR(50) DEFAULT 'Pending',
      request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      certificate_hash VARCHAR(255),
      valid_until DATETIME,
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(template_id) REFERENCES templates(id)
    )`);

    // Bonafide Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS bonafide_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      program_name VARCHAR(255) NOT NULL,
      academic_year VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Transfer Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS transfer_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      parent_name VARCHAR(255) NOT NULL,
      program_name VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      conduct VARCHAR(100) NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Achievement Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS achievement_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      achievement_title VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // NOC Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS noc_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      admission_number VARCHAR(100) NOT NULL,
      program_name VARCHAR(255) NOT NULL,
      year VARCHAR(50) NOT NULL,
      semester VARCHAR(50) NOT NULL,
      department VARCHAR(255) NOT NULL,
      organization_name VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      duration_days INT NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Project Completion Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS project_completion_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      project_title VARCHAR(255) NOT NULL,
      supervisor_name VARCHAR(255) NOT NULL,
      submission_date DATE NOT NULL,
      project_grade VARCHAR(50) NOT NULL,
      program_name VARCHAR(255) NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Idempotency Keys
    await connection.execute(`CREATE TABLE IF NOT EXISTS idempotency_keys(
      \`key\` VARCHAR(255) PRIMARY KEY,
      response JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      locked BOOLEAN DEFAULT FALSE
    )`);

    // Degree Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS degree_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      program_name VARCHAR(255) NOT NULL,
      academic_year VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Participation Certificate Details
    await connection.execute(`CREATE TABLE IF NOT EXISTS participation_certificates(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNIQUE NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_usn VARCHAR(100) NOT NULL,
      event_name VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      event_location VARCHAR(255) NOT NULL,
      institute_name VARCHAR(255) NOT NULL,
      issue_date DATE NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Clear existing dummy data (optional, based on previous code)
    // await connection.execute('DELETE FROM requests');
    // await connection.execute('DELETE FROM templates');

    // Verification Logs table
    await connection.execute(`CREATE TABLE IF NOT EXISTS verification_logs(
      id INT AUTO_INCREMENT PRIMARY KEY,
      certificate_hash VARCHAR(255) NOT NULL,
      is_valid BOOLEAN NOT NULL,
      verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_agent TEXT
    )`);

    // Status Events table for tracking request history
    await connection.execute(`CREATE TABLE IF NOT EXISTS status_events(
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
    )`);

    // Add download_count to requests if it doesn't exist
    try {
      await connection.execute(`ALTER TABLE requests ADD COLUMN download_count INT DEFAULT 0`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding download_count column:', err);
      }
    }

    connection.release();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDatabase();

module.exports = {
  pool,
  execute: (...args) => pool.execute(...args),
  initDatabase
};
