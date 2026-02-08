import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // 1. Ensure User 1 is in Workspace Members (workspace 1)
        const members = await query(
            'SELECT * FROM workspace_members WHERE workspace_id = 1 AND user_id = 1'
        );

        if ((members as any[]).length === 0) {
            await query(
                'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 1, "admin")'
            );
        }

        // 2. Ensure "General" channel exists
        const rooms = await query(
            'SELECT * FROM chat_rooms WHERE workspace_id = 1 AND name = "General"'
        );

        let generalRoomId;
        if ((rooms as any[]).length === 0) {
            const result = await query(
                'INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (1, "General", "channel", "Default general channel", 1)'
            );
            generalRoomId = (result as any).insertId;
        } else {
            generalRoomId = (rooms as any[])[0].id;
        }

        // 3. Ensure User 1 is in General channel
        const roomMembers = await query(
            'SELECT * FROM chat_room_members WHERE room_id = ? AND user_id = 1',
            [generalRoomId]
        );

        if ((roomMembers as any[]).length === 0) {
            await query(
                'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, 1)',
                [generalRoomId]
            );
        }

        // 4. Trial support - add columns if missing, create trial_requests table
        try {
            await query('ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP NULL');
        } catch (e: any) {
            if (!e?.message?.includes('Duplicate column')) {}
        }
        try {
            await query('ALTER TABLE users ADD COLUMN is_trial_approved BOOLEAN DEFAULT FALSE');
        } catch (e: any) {
            if (!e?.message?.includes('Duplicate column')) {}
        }
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS trial_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    company_name VARCHAR(255),
                    status ENUM('pending','approved','rejected') DEFAULT 'pending',
                    approved_by INT NULL,
                    approved_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_email (email),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        } catch (e) {}

        return NextResponse.json({ success: true, message: 'DB fixed' });
    } catch (error) {
        console.error('Fix DB error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
