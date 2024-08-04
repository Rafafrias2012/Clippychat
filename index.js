const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const rooms = {};
const users = {};

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', (data) => {
    const { user, room } = data;
    if (!rooms[room]) {
      rooms[room] = [];
    }
    if (!users[user]) {
      users[user] = room;
      rooms[room].push(user);
      socket.join(room);
      io.to(room).emit('join', user);
    }
  });

  socket.on('talk', (data) => {
    const { user, text } = data;
    io.to(users[user]).emit('talk', { user, text });
  });

  socket.on('update', (data) => {
    const { oldName, newName } = data;
    if (users[oldName]) {
      const room = users[oldName];
      users[newName] = room;
      delete users[oldName];
      io.to(room).emit('update', { oldName, newName });
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
  });

  socket.on('leave', (id) => {
    if (users[id]) {
      const room = users[id];
      rooms[room] = rooms[room].filter((user) => user!== id);
      delete users[id];
      io.to(room).emit('leave', id);
    }
  });
});

server.listen(3000, () => {
  console.log('Server started on port 3000');
});