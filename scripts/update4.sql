-- Make workspace_id nullable in projects table
ALTER TABLE projects MODIFY COLUMN workspace_id INT NULL;

-- Make workspace_id nullable in tasks table
ALTER TABLE tasks MODIFY COLUMN workspace_id INT NULL;

-- Drop existing foreign key constraint on projects if it exists (assuming constraint name 'fk_project_workspace' or similar handled by altering creation)
-- Since we are modifying, we just ensure it allows NULL.
-- NOTE: In MySQL, if the column is nullable, the FK constraint allows NULL values automatically.

-- Ensure task assignments work for any user (already handled by logic, but ensuring schema supports it)
-- No schema change needed for assignment logic, just API validation updates.
