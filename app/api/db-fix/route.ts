import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // 1. Drop the existing foreign key
        try {
            await query('ALTER TABLE chat_rooms DROP FOREIGN KEY fk_chatroom_workspace');
        } catch (e) {
            console.log('FK might not exist or already dropped', e);
        }

        // 2. Modify column to allow NULL
        await query('ALTER TABLE chat_rooms MODIFY COLUMN workspace_id INT NULL');

        // 3. Re-add Foreign Key (optional, but good for data integrity if workspace IS provided)
        // Note: If workspace_id is NULL, FK constraint is skipped.
        try {
            await query('ALTER TABLE chat_rooms ADD CONSTRAINT fk_chatroom_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE');
        } catch (e) {
            console.log('FK might already exist', e);
        }

        return NextResponse.json({ message: 'Database schema updated successfully: chat_rooms.workspace_id is now nullable' });
    } catch (error) {
        console.error('DB Fix Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
