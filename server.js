const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
       path: '/api/socket/io',
       addTrailingSlash: false,
       cors: {
           origin: "*",
           methods: ["GET", "POST"]
       }
  });

  io.on('connection', (socket) => {
       console.log('Socket connected:', socket.id);

       socket.on('join-room', (roomId) => {
           socket.join(`room:${roomId}`);
           console.log(`Socket ${socket.id} joined room:${roomId}`);
       });

       socket.on('leave-room', (roomId) => {
           socket.leave(`room:${roomId}`);
       });

       socket.on('join-user', (userId) => {
           socket.join(`user:${userId}`);
           console.log(`Socket ${socket.id} joined user:${userId}`);
       });

       socket.on('send-message', (message) => {
           console.log("Broadcasting message to", message.room_id);
           socket.to(`room:${message.room_id}`).emit('new-message', message);
       });

       socket.on('typing', (data) => {
           socket.to(`room:${data.roomId}`).emit('typing', data);
       });

       socket.on('edit-message', (data) => {
           socket.to(`room:${data.room_id}`).emit('message-updated', data);
       });

       socket.on('delete-message', (data) => {
           socket.to(`room:${data.room_id}`).emit('message-deleted', data);
       });

       socket.on('notify-user', (data) => {
           // data: { userId, roomId }
           console.log("Sending notification to user:", data.userId);
           socket.to(`user:${data.userId}`).emit('notification', { type: 'message', roomId: data.roomId });
       });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
