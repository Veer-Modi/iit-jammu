-- Update 3: Chat System Enhancements (Safe Run)

-- Add reply_to_id safely
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reply_to_id' AND table_schema = DATABASE());
SET @sqlstmt := IF( @exist = 0, 'ALTER TABLE messages ADD COLUMN reply_to_id INT NULL AFTER id', 'SELECT "reply_to_id already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add reactions safely
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reactions' AND table_schema = DATABASE());
SET @sqlstmt := IF( @exist = 0, 'ALTER TABLE messages ADD COLUMN reactions JSON NULL AFTER attachment_url', 'SELECT "reactions already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_edited safely
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_edited' AND table_schema = DATABASE());
SET @sqlstmt := IF( @exist = 0, 'ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE AFTER is_pinned', 'SELECT "is_edited already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for reply_to_id if not exists (harder to check properly in pure SQL without query, assuming it might fail if exists so we ignore error or just run it)
-- Simplified: Just try to add constraint, if it fails it fails.
-- ALTER TABLE messages ADD CONSTRAINT fk_message_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Create chat_notifications
CREATE TABLE IF NOT EXISTS chat_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  UNIQUE KEY unique_notification (user_id, room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
