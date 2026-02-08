import { query } from '@/lib/db';

export async function sendSystemMessage(workspaceId: number, content: string) {
    try {
        // 1. Find General Room for this Workspace
        // We assume "General" is the default channel. 
        const rooms = await query('SELECT id FROM chat_rooms WHERE name = ? AND workspace_id = ? LIMIT 1', ['General', workspaceId]);

        let roomId;
        if (Array.isArray(rooms) && rooms.length > 0) {
            roomId = (rooms[0] as any).id;
        } else {
            // Create General room if missing (e.g. older workspaces)
            let creatorId = null;
            const ownerRows = await query('SELECT owner_id FROM workspaces WHERE id = ?', [workspaceId]);
            if (Array.isArray(ownerRows) && ownerRows.length > 0) creatorId = (ownerRows[0] as any).owner_id;
            if (!creatorId) {
                const adminRows = await query('SELECT user_id FROM workspace_members WHERE workspace_id = ? LIMIT 1', [workspaceId]);
                if (Array.isArray(adminRows) && adminRows.length > 0) creatorId = (adminRows[0] as any).user_id;
            }
            if (!creatorId) {
                console.warn(`Cannot create General room for workspace ${workspaceId}: no owner/members.`);
                return;
            }
            await query(
                `INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) 
                 VALUES (?, ?, ?, ?, ?)`,
                [workspaceId, 'General', 'channel', 'General discussion and announcements', creatorId]
            );
            const newRooms = await query('SELECT id FROM chat_rooms WHERE workspace_id = ? AND name = ? LIMIT 1', [workspaceId, 'General']);
            if (Array.isArray(newRooms) && newRooms.length > 0) {
                roomId = (newRooms[0] as any).id;
                await query('INSERT INTO chat_room_members (room_id, user_id) SELECT ?, user_id FROM workspace_members WHERE workspace_id = ?', [roomId, workspaceId]);
            } else {
                console.warn(`Failed to create General room for workspace ${workspaceId}.`);
                return;
            }
        }

        // 2. Insert Message
        // We use a special system user ID (e.g., 0) or just null sender if allowed, 
        // but our schema enforces sender_id. 
        // Let's use the workspace creator or a dedicated "System" bot user if it existed.
        // For now, let's try to find an admin to "send" it, or arguably better, 
        // we should have a 'system' type message that doesn't strictly require a valid user sender in UI,
        // but DB requires sender_id.
        // Let's pick the first admin of the workspace.

        let systemSenderId = null;
        const adminResult = await query('SELECT user_id FROM workspace_members WHERE workspace_id = ? AND role = "admin" LIMIT 1', [workspaceId]);
        if (Array.isArray(adminResult) && adminResult.length > 0) {
            systemSenderId = (adminResult[0] as any).user_id;
        }
        if (!systemSenderId) {
            const anyMember = await query('SELECT user_id FROM workspace_members WHERE workspace_id = ? LIMIT 1', [workspaceId]);
            if (Array.isArray(anyMember) && anyMember.length > 0) {
                systemSenderId = (anyMember[0] as any).user_id;
            }
        }
        const ownerResult = await query('SELECT owner_id FROM workspaces WHERE id = ? LIMIT 1', [workspaceId]);
        if (!systemSenderId && Array.isArray(ownerResult) && ownerResult.length > 0) {
            systemSenderId = (ownerResult[0] as any).owner_id;
        }
        if (!systemSenderId) return;

        await query(
            `INSERT INTO messages (room_id, sender_id, content, message_type) 
       VALUES (?, ?, ?, 'system')`,
            [roomId, systemSenderId, content]
        );

        // 3. Notify (Optional: relying on client polling for now as socket emitting from server-side route without context is hard)
        // If we had a global socket instance we could emit 'message-receive'.

    } catch (error) {
        console.error('Failed to send system message:', error);
    }
}

/** Send task comment as DM to workspace admin so admin sees daily task updates */
export async function sendTaskCommentToAdminDm(
    workspaceId: number,
    commenterId: number,
    commenterName: string,
    taskId: number,
    taskTitle: string,
    commentContent: string
) {
    try {
        // 1. Find workspace admin
        const adminRows = await query('SELECT user_id FROM workspace_members WHERE workspace_id = ? AND (role = "admin" OR role = "manager") ORDER BY role = "admin" DESC LIMIT 1', [workspaceId]);
        let adminId = null;
        if (Array.isArray(adminRows) && adminRows.length > 0) adminId = (adminRows[0] as any).user_id;
        if (!adminId) {
            const ownerRows = await query('SELECT owner_id FROM workspaces WHERE id = ?', [workspaceId]);
            if (Array.isArray(ownerRows) && ownerRows.length > 0) adminId = (ownerRows[0] as any).owner_id;
        }
        if (!adminId || adminId === commenterId) return;

        // 2. Find or create DM room between commenter and admin
        const existingDm = await query(
            `SELECT r.id FROM chat_rooms r
             JOIN chat_room_members m1 ON r.id = m1.room_id AND m1.user_id = ?
             JOIN chat_room_members m2 ON r.id = m2.room_id AND m2.user_id = ?
             WHERE r.type = 'direct' AND r.workspace_id = ? LIMIT 1`,
            [commenterId, adminId, workspaceId]
        );
        let roomId: number;
        if (Array.isArray(existingDm) && existingDm.length > 0) {
            roomId = (existingDm[0] as any).id;
        } else {
            const insertRoom = await query(
                `INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (?, ?, ?, ?, ?)`,
                [workspaceId, 'DM', 'direct', null, commenterId]
            );
            roomId = (insertRoom as any).insertId;
            await query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?), (?, ?)', [roomId, commenterId, roomId, adminId]);
        }

        // 3. Insert message as employee (commenter) - appears as from employee in admin's DM
        const msg = `📋 **Task Update** — [${taskTitle}]\n${commentContent}`;
        await query(
            'INSERT INTO messages (room_id, sender_id, content, message_type) VALUES (?, ?, ?, ?)',
            [roomId, commenterId, msg, 'text']
        );

        // 4. Increment unread for admin
        await query(
            `INSERT INTO chat_notifications (user_id, room_id, unread_count)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP`,
            [adminId, roomId]
        );
    } catch (err) {
        console.error('Failed to send task comment to admin DM:', err);
    }
}
