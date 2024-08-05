const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let users = {};

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', ({ user, room }) => {
    users[user.id] = user;
    socket.join(room);
    io.in(room).emit('join', user);
  });

  socket.on('talk', ({ user, text }) => {
    io.in(user.room).emit('talk', { user, text });
  });

  socket.on('updateUser', (user) => {
    users[user.id] = user;
    io.in(user.room).emit('update', user);
  });

  socket.on('kickUser', (id) => {
    const user = users[id];
    if (user) {
      io.in(user.room).emit('leave', id);
      delete users[id];
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
