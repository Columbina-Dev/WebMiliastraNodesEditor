import http from 'node:http';
import { WebSocketServer } from 'ws';

const DEFAULT_PORT = 5174;
const port = Number.parseInt(process.env.COLLAB_PORT ?? process.env.PORT ?? '', 10) || DEFAULT_PORT;

const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Map();
const clientsById = new Map();
const rooms = new Map();

const normalizeAddress = (address) => {
  if (!address) return '';
  if (address.startsWith('::ffff:')) {
    return address.slice('::ffff:'.length);
  }
  return address;
};

const safeSend = (socket, message) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcast = (message) => {
  wss.clients.forEach((socket) => {
    safeSend(socket, message);
  });
};

const getShareList = () =>
  Array.from(rooms.values()).map((room) => room.meta);

const broadcastShareList = () => {
  broadcast({ type: 'share:list', shares: getShareList() });
};

const removeRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  room.members.forEach((memberId) => {
    const memberSocket = clientsById.get(memberId);
    if (memberSocket) {
      safeSend(memberSocket, { type: 'room:closed', roomId });
    }
  });
  rooms.delete(roomId);
  broadcastShareList();
};

const handleClientLeave = (roomId, clientId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  if (!room.members.has(clientId)) return;
  room.members.delete(clientId);
  safeSend(room.hostSocket, { type: 'room:member-left', roomId, clientId });
};

const findRoomByHostSocket = (socket) => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.hostSocket === socket) {
      return { roomId, room };
    }
  }
  return null;
};

const findRoomsByMember = (clientId) => {
  const matches = [];
  rooms.forEach((room, roomId) => {
    if (room.members.has(clientId)) {
      matches.push(roomId);
    }
  });
  return matches;
};

wss.on('connection', (socket, request) => {
  const remoteAddress = normalizeAddress(request.socket.remoteAddress ?? '');

  socket.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch (error) {
      return;
    }

    if (!message || typeof message.type !== 'string') return;

    switch (message.type) {
      case 'hello': {
        const clientId = String(message.clientId ?? '');
        if (!clientId) return;
        const nickname = typeof message.nickname === 'string' ? message.nickname : '';
        const avatar = typeof message.avatar === 'string' ? message.avatar : undefined;
        clients.set(socket, { clientId, nickname, avatar });
        clientsById.set(clientId, socket);
        safeSend(socket, { type: 'share:list', shares: getShareList() });
        return;
      }
      case 'profile:update': {
        const clientId = String(message.clientId ?? '');
        const record = clients.get(socket);
        if (!record || record.clientId !== clientId) return;
        const nickname = typeof message.nickname === 'string' ? message.nickname : record.nickname;
        const avatar = typeof message.avatar === 'string' ? message.avatar : record.avatar;
        clients.set(socket, { clientId, nickname, avatar });
        return;
      }
      case 'share:announce': {
        const roomId = String(message.roomId ?? '');
        const hostId = String(message.hostId ?? '');
        if (!roomId || !hostId) return;
        const meta = {
          roomId,
          hostId,
          projectId: String(message.projectId ?? ''),
          name: String(message.name ?? ''),
          appVersion: String(message.appVersion ?? ''),
          requiresPassword: Boolean(message.requiresPassword),
          ownerNickname: String(message.ownerNickname ?? ''),
          address: remoteAddress || String(message.address ?? ''),
          updatedAt: Date.now(),
        };
        rooms.set(roomId, {
          hostId,
          hostSocket: socket,
          meta,
          members: rooms.get(roomId)?.members ?? new Set(),
        });
        broadcastShareList();
        return;
      }
      case 'share:remove': {
        const roomId = String(message.roomId ?? '');
        if (!roomId) return;
        const existing = rooms.get(roomId);
        if (!existing || existing.hostSocket !== socket) return;
        removeRoom(roomId);
        return;
      }
      case 'join:request': {
        const roomId = String(message.roomId ?? '');
        const clientId = String(message.clientId ?? '');
        if (!roomId || !clientId) return;
        const room = rooms.get(roomId);
        if (!room) {
          safeSend(socket, { type: 'join:denied', roomId, reason: 'not_found' });
          return;
        }
        safeSend(room.hostSocket, {
          type: 'join:request',
          roomId,
          clientId,
          nickname: String(message.nickname ?? ''),
          avatar: typeof message.avatar === 'string' ? message.avatar : undefined,
          password: typeof message.password === 'string' ? message.password : undefined,
          requestId: String(message.requestId ?? ''),
        });
        return;
      }
      case 'join:approve': {
        const roomId = String(message.roomId ?? '');
        const clientId = String(message.clientId ?? '');
        if (!roomId || !clientId) return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocket !== socket) return;
        room.members.add(clientId);
        const memberSocket = clientsById.get(clientId);
        if (memberSocket) {
          safeSend(memberSocket, {
            type: 'join:approved',
            roomId,
            hostId: room.hostId,
            permission: String(message.permission ?? 'editor'),
          });
        }
        return;
      }
      case 'join:deny': {
        const roomId = String(message.roomId ?? '');
        const clientId = String(message.clientId ?? '');
        if (!roomId || !clientId) return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocket !== socket) return;
        const memberSocket = clientsById.get(clientId);
        if (memberSocket) {
          safeSend(memberSocket, {
            type: 'join:denied',
            roomId,
            reason: String(message.reason ?? ''),
          });
        }
        return;
      }
      case 'client:message': {
        const roomId = String(message.roomId ?? '');
        if (!roomId) return;
        const room = rooms.get(roomId);
        const client = clients.get(socket);
        if (!room || !client) return;
        const payload = message.payload;
        safeSend(room.hostSocket, {
          type: 'client:message',
          roomId,
          clientId: client.clientId,
          payload,
        });
        if (payload && payload.type === 'cursor:update') {
          room.members.forEach((memberId) => {
            if (memberId === client.clientId) return;
            const memberSocket = clientsById.get(memberId);
            if (memberSocket) {
              safeSend(memberSocket, { type: 'room:message', roomId, payload });
            }
          });
        }
        return;
      }
      case 'room:message': {
        const roomId = String(message.roomId ?? '');
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocket !== socket) return;
        const payload = message.payload;
        const targetId = typeof message.targetId === 'string' ? message.targetId : null;
        if (targetId) {
          const targetSocket = clientsById.get(targetId);
          if (targetSocket) {
            safeSend(targetSocket, { type: 'room:message', roomId, payload });
          }
          return;
        }
        room.members.forEach((memberId) => {
          const memberSocket = clientsById.get(memberId);
          if (memberSocket) {
            safeSend(memberSocket, { type: 'room:message', roomId, payload });
          }
        });
        return;
      }
      case 'room:leave': {
        const roomId = String(message.roomId ?? '');
        const clientId = String(message.clientId ?? '');
        if (!roomId || !clientId) return;
        handleClientLeave(roomId, clientId);
        return;
      }
      default:
        return;
    }
  });

  socket.on('close', () => {
    const record = clients.get(socket);
    if (record) {
      clients.delete(socket);
      if (clientsById.get(record.clientId) === socket) {
        clientsById.delete(record.clientId);
      }
      const roomsWithMember = findRoomsByMember(record.clientId);
      roomsWithMember.forEach((roomId) => handleClientLeave(roomId, record.clientId));
    }

    const hostRoom = findRoomByHostSocket(socket);
    if (hostRoom) {
      removeRoom(hostRoom.roomId);
    }
  });
});

server.listen(port, () => {
  console.log(`[collab] signaling server listening on :${port}`);
});
