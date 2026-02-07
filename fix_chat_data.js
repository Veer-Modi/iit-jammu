const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function fixChatData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Connected to database.');

    // 1. Ensure User 1 is in Workspace Members (assuming workspace 1)
    const [members] = await connection.execute(
      'SELECT * FROM workspace_members WHERE workspace_id = 1 AND user_id = 1'
    );

    if (members.length === 0) {
      console.log('User 1 is not a member of Workspace 1. Adding...');
      await connection.execute(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 1, "admin")'
      );
      console.log('User 1 added to Workspace 1.');
    } else {
      console.log('User 1 is already a member of Workspace 1.');
    }

    // 2. Ensure "General" channel exists
    const [rooms] = await connection.execute(
      'SELECT * FROM chat_rooms WHERE workspace_id = 1 AND name = "General"'
    );

    let generalRoomId;
    if (rooms.length === 0) {
      console.log('General channel does not exist. Creating...');
      const [result] = await connection.execute(
        'INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (1, "General", "channel", "Default general channel", 1)'
      );
      generalRoomId = result.insertId;
      console.log(`General channel created with ID: ${generalRoomId}`);
    } else {
      generalRoomId = rooms[0].id;
      console.log(`General channel exists with ID: ${generalRoomId}`);
    }

    // 3. Ensure User 1 is in General channel
    const [roomMembers] = await connection.execute(
      'SELECT * FROM chat_room_members WHERE room_id = ? AND user_id = 1',
      [generalRoomId]
    );

    if (roomMembers.length === 0) {
        console.log('User 1 is not in General channel. Adding...');
        await connection.execute(
            'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, 1)',
            [generalRoomId]
        );
        console.log('User 1 added to General channel.');
    } else {
        console.log('User 1 is already in General channel.');
    }

  } catch (error) {
    console.error('Error fixing chat data:', error);
  } finally {
    await connection.end();
  }
}

fixChatData();
