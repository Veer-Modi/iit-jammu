INSERT INTO workspaces (id, name, owner_id) VALUES (1, 'Global Workspace', 1) ON DUPLICATE KEY UPDATE name='Global Workspace';
