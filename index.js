const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let users = {};
let admins = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('New connection');

  socket.on('join', (data) => {
    const { nickname, room } = data;
    users[nickname] = socket.id;
    admins[nickname] = false; // default to not admin
    socket.join(room);
    io.to(room).emit('join', { nickname, isAdmin: admins[nickname] });
  });

  socket.on('talk', (data) => {
    const { text } = data;
    io.to(socket.room).emit('talk', { user: socket.nickname, text });
  });

  socket.on('changeName', (data) => {
    const { oldNickname, newNickname } = data;
    users[newNickname] = users[oldNickname];
    delete users[oldNickname];
    admins[newNickname] = admins[oldNickname];
    delete admins[oldNickname];
    io.to(socket.room).emit('update', { oldNickname, newNickname });
  });

  socket.on('asshole', (data) => {
    const { target } = data;
    io.to(socket.room).emit('asshole', { user: socket.nickname, target });
  });

  socket.on('owo', (data) => {
    const { target } = data;
    io.to(socket.room).emit('owo', { user: socket.nickname, target });
  });

  socket.on('kickUser', (data) => {
    const { user } = data;
    io.to(socket.room).emit('leave', user);
    delete users[user];
    delete admins[user];
  });

  socket.on('disconnect', () => {
    console.log('Disconnected');
    io.to(socket.room).emit('leave', socket.nickname);
    delete users[socket.nickname];
    delete admins[socket.nickname];
  });
});

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
