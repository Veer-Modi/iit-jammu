const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

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
  console.log('Connected as id ' + connection.threadId);

  // 1. Check member
  connection.query('SELECT * FROM workspace_members WHERE workspace_id = 1 AND user_id = 1', (error, results) => {
    if (error) throw error;
    if (results.length === 0) {
      console.log('Adding user 1 to workspace 1...');
      connection.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 1, "admin")', (err) => {
        if (err) throw err;
        console.log('Added.');
        checkGeneral();
      });
    } else {
      console.log('User 1 is member.');
      checkGeneral();
    }
  });
});

function checkGeneral() {
  connection.query('SELECT * FROM chat_rooms WHERE workspace_id = 1 AND name = "General"', (error, results) => {
    if (error) throw error;
    let roomId;
    if (results.length === 0) {
        console.log('Creating General...');
        connection.query('INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (1, "General", "channel", "Default", 1)', (err, res) => {
            if (err) throw err;
            roomId = res.insertId;
            console.log('General created:', roomId);
            addUserToRoom(roomId);
        });
    } else {
        roomId = results[0].id;
        console.log('General exists:', roomId);
        addUserToRoom(roomId);
    }
  });
}

function addUserToRoom(roomId) {
    connection.query('SELECT * FROM chat_room_members WHERE room_id = ? AND user_id = 1', [roomId], (err, res) => {
        if (err) throw err;
        if (res.length === 0) {
            connection.query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, 1)', [roomId], (err) => {
                if (err) throw err;
                console.log('User added to General.');
                connection.end();
            });
        } else {
            console.log('User already in General.');
            connection.end();
        }
    });
}
