// server.js
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = 3000;

// Store user data in memory for simplicity
const users = {};
const rooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Client connected');

    // Handle join event
    socket.on('join', (data) => {
        const { user, room } = data;
        if (!rooms[room]) {
            rooms[room] = {};
        }
        rooms[room][user] = socket.id;
        users[socket.id] = { user, room };

        // Broadcast join event to all clients in the room
        io.to(room).emit('join', { user });

        // Handle leave event when client disconnects
        socket.on('disconnect', () => {
            if (users[socket.id]) {
                const { user, room } = users[socket.id];
                delete rooms[room][user];
                delete users[socket.id];

                // Broadcast leave event to all clients in the room
                io.to(room).emit('leave', user);
            }
        });
    });

    // Handle talk event
    socket.on('talk', (data) => {
        const { user, text } = data;
        const room = users[socket.id].room;

        // Broadcast talk event to all clients in the room
        io.to(room).emit('talk', { user, text });
    });

    // Handle uploadImage event
    socket.on('uploadImage', (data) => {
        const { user, image } = data;
        const room = users[socket.id].room;

        // Broadcast uploadImage event to all clients in the room
        io.to(room).emit('uploadImage', { user, image });
    });

    // Handle changeName event
    socket.on('changeName', (data) => {
        const { oldName, newName } = data;
        const room = users[socket.id].room;

        // Update user data
        users[socket.id].user = newName;
        rooms[room][newName] = socket.id;
        delete rooms[room][oldName];

        // Broadcast update event to all clients in the room
        io.to(room).emit('update', { oldName, newName });
    });

    // Handle kickUser event (admin action)
    socket.on('kickUser', (data) => {
        const { user } = data;
        const room = users[socket.id].room;

        // Find the socket ID of the user to kick
        const socketId = rooms[room][user];

        // If the user is found, disconnect them
        if (socketId) {
            io.sockets.sockets[socketId].disconnect();
        }
    });

    // Handle banUser event (admin action)
    socket.on('banUser', (data) => {
        const { user, reason, length } = data;
        const room = users[socket.id].room;

        // Find the socket ID of the user to ban
        const socketId = rooms[room][user];

        // If the user is found, disconnect them and store the ban data
        if (socketId) {
            io.sockets.sockets[socketId].disconnect();
            // Store the ban data in a database or a file
            console.log(`User ${user} banned for ${length} minutes: ${reason}`);
        }
    });

    // Handle muteUser event (admin action)
    socket.on('muteUser', (data) => {
        const { user } = data;
        const room = users[socket.id].room;

        // Find the socket ID of the user to mute
        const socketId = rooms[room][user];

        // If the user is found, mute them
        if (socketId) {
            // Implement muting logic here
            console.log(`User ${user} muted`);
        }
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
