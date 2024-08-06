const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'frontend')));

const users = {};
const rooms = {};
const adminPassword = 'doctus123';
const modPassword = 'guitar';

const MESSAGE_LIMIT = 500;
const NAME_LIMIT = 35;
const SPAM_LIMIT = 3;
const ALT_LIMIT = 3;
const SLOWMODE_DELAY = 3000; // 3 seconds
const FLOOD_WINDOW = 5000; // 5 seconds
const FLOOD_MESSAGE_LIMIT = 5;

const userMessageCounts = {};
const userIPs = {};

function isSpam(userId) {
    if (!userMessageCounts[userId]) {
        userMessageCounts[userId] = { count: 1, lastMessageTime: Date.now() };
        return false;
    }

    const now = Date.now();
    if (now - userMessageCounts[userId].lastMessageTime < FLOOD_WINDOW) {
        userMessageCounts[userId].count++;
        if (userMessageCounts[userId].count > FLOOD_MESSAGE_LIMIT) {
            return true;
        }
    } else {
        userMessageCounts[userId] = { count: 1, lastMessageTime: now };
    }

    return false;
}

io.on('connection', (socket) => {
    console.log('A user connected');

    let lastMessageTime = 0;

    socket.on('login', (data) => {
        const ip = socket.handshake.address;
        if (!userIPs[ip]) {
            userIPs[ip] = [];
        }
        if (userIPs[ip].length >= ALT_LIMIT) {
            socket.emit('error', 'Too many alternate accounts');
            return;
        }

        const user = {
            id: socket.id,
            name: data.nickname.slice(0, NAME_LIMIT),
            room: data.room,
            x: Math.random() * 800,
            y: Math.random() * 600,
            isAdmin: false,
            isMod: false,
            agentType: data.agentType || 'clippy'
        };

        users[socket.id] = user;
        userIPs[ip].push(socket.id);
        socket.join(user.room);

        if (!rooms[user.room]) {
            rooms[user.room] = [];
        }
        rooms[user.room].push(socket.id);

        socket.emit('loginSuccess', user);
        socket.to(user.room).emit('userJoined', user);

        rooms[user.room].forEach((userId) => {
            if (userId !== socket.id) {
                socket.emit('userJoined', users[userId]);
            }
        });
    });

    socket.on('chat', (data) => {
        const user = users[socket.id];
        if (user) {
            const now = Date.now();
            if (now - lastMessageTime < SLOWMODE_DELAY) {
                socket.emit('error', 'You are sending messages too quickly');
                return;
            }
            lastMessageTime = now;

            if (isSpam(socket.id)) {
                socket.emit('error', 'You are sending too many messages');
                return;
            }

            if (data.message.length > MESSAGE_LIMIT) {
                data.message = data.message.slice(0, MESSAGE_LIMIT);
            }

            io.to(user.room).emit('chat', {
                id: socket.id,
                message: data.message,
                type: data.type
            });
        }
    });

    socket.on('updatePosition', (data) => {
        const user = users[socket.id];
        if (user) {
            user.x = data.x;
            user.y = data.y;
            socket.to(user.room).emit('updatePosition', {
                id: socket.id,
                x: data.x,
                y: data.y
            });
        }
    });

    socket.on('changeName', (data) => {
        const user = users[socket.id];
        if (user) {
            user.name = data.name.slice(0, NAME_LIMIT);
            io.to(user.room).emit('nameChanged', {
                id: socket.id,
                name: user.name
            });
        }
    });

    socket.on('typing', () => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('typing', socket.id);
        }
    });

    socket.on('changeRoom', (data) => {
        const user = users[socket.id];
        if (user) {
            socket.leave(user.room);
            rooms[user.room] = rooms[user.room].filter(id => id !== socket.id);
            socket.to(user.room).emit('userLeft', socket.id);

            user.room = data.room;
            socket.join(user.room);

            if (!rooms[user.room]) {
                rooms[user.room] = [];
            }
            rooms[user.room].push(socket.id);

            socket.emit('roomChanged', { room: user.room });
            socket.to(user.room).emit('userJoined', user);
        }
    });

    socket.on('changeAgent', (data) => {
        const user = users[socket.id];
        if (user) {
            user.agentType = data.agentType;
            io.to(user.room).emit('agentChanged', {
                id: socket.id,
                agentType: user.agentType
            });
        }
    });

    socket.on('adminLogin', (data) => {
        const user = users[socket.id];
        if (user && data.password === adminPassword) {
            user.isAdmin = true;
            socket.emit('adminLogin', true);
        } else {
            socket.emit('adminLogin', false);
        }
    });

    socket.on('modLogin', (data) => {
        const user = users[socket.id];
        if (user && data.password === modPassword) {
            user.isMod = true;
            socket.emit('modLogin', true);
        } else {
            socket.emit('modLogin', false);
        }
    });

    socket.on('kickUser', (data) => {
        const user = users[socket.id];
        if (user && (user.isAdmin || user.isMod)) {
            const userToKick = Object.values(users).find(u => u.name === data.user);
            if (userToKick) {
                io.to(userToKick.id).emit('kicked');
                io.sockets.sockets.get(userToKick.id).disconnect(true);
            }
        }
    });

    socket.on('announcement', (data) => {
        const user = users[socket.id];
        if (user && (user.isAdmin || user.isMod)) {
            io.emit('announcement', { message: data.message });
        }
    });

    socket.on('restartServer', () => {
        const user = users[socket.id];
        if (user && user.isAdmin) {
            io.emit('serverRestart');
            console.log('Server restart requested by admin');
            // Implement actual server restart logic here
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('userLeft', socket.id);
            if (rooms[user.room]) {
                rooms[user.room] = rooms[user.room].filter(id => id !== socket.id);
            }
            delete users[socket.id];
            const ip = socket.handshake.address;
            if (userIPs[ip]) {
                userIPs[ip] = userIPs[ip].filter(id => id !== socket.id);
                if (userIPs[ip].length === 0) {
                    delete userIPs[ip];
                }
            }
        }
    });
});

http.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
