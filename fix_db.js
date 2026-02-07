const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected to database.');

  // 0. Ensure Workspace 1 exists
  connection.query('INSERT INTO workspaces (id, name, owner_id) VALUES (1, "Global Workspace", 1) ON DUPLICATE KEY UPDATE name="Global Workspace"', (err) => {
    if (err) console.error('Workspace fix error:', err);
    else console.log('Workspace 1 ensured.');

    // 1. Ensure User 1 is in Workspace Members (workspace 1)
    connection.query('SELECT * FROM workspace_members WHERE workspace_id = 1 AND user_id = 1', (error, results) => {
    if (error) {
        console.error(error);
        connection.end();
        return;
    }
    
    if (results.length === 0) {
      console.log('User 1 is NOT a member of Workspace 1. Adding as admin...');
      connection.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 1, "admin")', (err) => {
        if (err) console.error(err);
        else console.log('User 1 added to Workspace 1 successfully.');
        checkGeneral();
      });
    } else {
      console.log('User 1 is ALREADY a member of Workspace 1.');
      checkGeneral();
    }
  });
});

function checkGeneral() {
  connection.query('SELECT * FROM chat_rooms WHERE workspace_id = 1 AND name = "General"', (error, results) => {
    if (error) {
        console.error(error);
        connection.end();
        return;
    }
    
    let roomId;
    if (results.length === 0) {
        console.log('General channel does NOT exist. Creating...');
        connection.query('INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (1, "General", "channel", "Default general channel", 1)', (err, res) => {
            if (err) {
                console.error(err);
                connection.end();
                return;
            }
            roomId = res.insertId;
            console.log(`General channel created with ID: ${roomId}`);
            addUserToRoom(roomId);
        });
    } else {
        roomId = results[0].id;
        console.log(`General channel exists with ID: ${roomId}`);
        addUserToRoom(roomId);
    }
  });
}

function addUserToRoom(roomId) {
    connection.query('SELECT * FROM chat_room_members WHERE room_id = ? AND user_id = 1', [roomId], (err, res) => {
        if (err) {
            console.error(err);
            connection.end();
            return;
        }
        
        if (res.length === 0) {
            console.log('User 1 is NOT in General channel. Adding...');
            connection.query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, 1)', [roomId], (err) => {
                if (err) console.error(err);
                else console.log('User 1 added to General channel.');
                connection.end();
            });
        } else {
            console.log('User 1 is ALREADY in General channel.');
            connection.end();
        }
    });
  }); // End workspace query
}); // End connection connect
