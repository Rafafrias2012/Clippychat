const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store room information
const rooms = {};

io.on('connection', (socket) => {
  let currentUser = null;
  let currentRoom = null;

  socket.on('join', (data) => {
    currentUser = data.user;
    currentRoom = data.room;

    socket.join(currentRoom);

    if (!rooms[currentRoom]) {
      rooms[currentRoom] = { users: {} };
    }

    rooms[currentRoom].users[socket.id] = { name: currentUser, isAdmin: Object.keys(rooms[currentRoom].users).length === 0 };

    socket.emit('joined', { user: currentUser });
    socket.emit('adminStatus', rooms[currentRoom].users[socket.id].isAdmin);
    socket.to(currentRoom).emit('userJoined', { user: currentUser });
  });

  socket.on('chat', (data) => {
    io.to(currentRoom).emit('chat', { user: currentUser, text: data.text });
  });

  socket.on('changeName', (data) => {
    const oldName = currentUser;
    currentUser = data.newName;
    rooms[currentRoom].users[socket.id].name = currentUser;
    io.to(currentRoom).emit('nameChanged', { oldName: oldName, newName: currentUser });
  });

  socket.on('changeColor', (data) => {
    io.to(currentRoom).emit('colorChanged', { user: currentUser, color: data.color });
  });

  socket.on('sendImage', (data) => {
    io.to(currentRoom).emit('imageMessage', { user: currentUser, url: data.url });
  });

  socket.on('kickUser', (data) => {
    if (rooms[currentRoom].users[socket.id].isAdmin) {
      const userToKick = Object.keys(rooms[currentRoom].users).find(id => rooms[currentRoom].users[id].name === data.user);
      if (userToKick) {
        io.to(userToKick).emit('kicked');
        io.sockets.sockets.get(userToKick).disconnect();
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      io.to(currentRoom).emit('userLeft', { id: currentUser });

      if (Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      } else if (rooms[currentRoom].users[socket.id]?.isAdmin) {
        // Assign admin status to the next user
        const nextAdmin = Object.keys(rooms[currentRoom].users)[0];
        rooms[currentRoom].users[nextAdmin].isAdmin = true;
        io.to(nextAdmin).emit('adminStatus', true);
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
