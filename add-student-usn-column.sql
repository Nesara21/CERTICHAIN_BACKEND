-- Add student_usn column to all certificate tables
-- This column is referenced in the code but missing from the database

ALTER TABLE degree_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE bonafide_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE transfer_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE achievement_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE noc_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE project_completion_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
ALTER TABLE participation_certificates ADD COLUMN IF NOT EXISTS student_usn VARCHAR(50) AFTER student_name;
