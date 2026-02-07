-- Update script to add Startup-Ready features to the database

-- Add new columns to workspace_members for Role and Equity management
ALTER TABLE workspace_members 
ADD COLUMN job_title VARCHAR(100) AFTER role,
ADD COLUMN department VARCHAR(100) AFTER job_title,
ADD COLUMN equity DECIMAL(5,2) DEFAULT 0.00 AFTER department;

-- Confirmation
SELECT 'Successfully added job_title, department, and equity to workspace_members' AS status;
