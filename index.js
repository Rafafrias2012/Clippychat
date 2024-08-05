const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let users = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('New connection');

  socket.on('join', (data) => {
    let user = {
      id: socket.id,
      nickname: data.nickname,
      roomId: data.roomId,
      isAdmin: false
    };
    users[socket.id] = user;
    socket.emit('join', user);
    socket.broadcast.emit('join', user);
  });

  socket.on('talk', (text) => {
    socket.emit('talk', { id: socket.id, text: text });
    socket.broadcast.emit('talk', { id: socket.id, text: text });
  });

  socket.on('update', (data) => {
    users[socket.id].nickname = data.nickname;
    users[socket.id].isAdmin = data.isAdmin;
    socket.emit('update', users[socket.id]);
    socket.broadcast.emit('update', users[socket.id]);
  });

  socket.on('kick', (id) => {
    if (users[id]) {
      socket.emit('leave', id);
      socket.broadcast.emit('leave', id);
      delete users[id];
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      socket.emit('leave', socket.id);
      socket.broadcast.emit('leave', socket.id);
      delete users[socket.id];
    }
  });
});

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
