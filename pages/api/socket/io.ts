
import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';
import { query } from '@/lib/db';

export const config = {
    api: {
        bodyParser: false,
    },
};

const ioHandler = (req: NextApiRequest, res: any) => {
    if (!res.socket.server.io) {
        const path = '/api/socket/io';
        const httpServer: NetServer = res.socket.server as any;
        const io = new ServerIO(httpServer, {
            path: path,
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

            socket.on('send-message', async (message) => {
                // Broadcast to the room
                console.log("Broadcasting message to", message.room_id);
                socket.to(`room:${message.room_id}`).emit('new-message', message);

                // Also emit a notification event to users in that room (except sender)
                // We need to fetch room members to notify them individually if we want global badge updates
                // For now, let's emit a 'notification' event to the room, clients can filter if it's for them?
                // Better: client joins 'user:ID' room.
            });

            socket.on('join-user', (userId) => {
                socket.join(`user:${userId}`);
                console.log(`Socket ${socket.id} joined user:${userId}`);
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

        });

        res.socket.server.io = io;
    }
    res.end();
};

export default ioHandler;
