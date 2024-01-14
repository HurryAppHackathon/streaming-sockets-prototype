const { default: axios } = require('axios');
const express = require('express');
const http = require('http');
const path = require('path');
const { PATHS, ERRORS, DEFAULT_OPTIONS, ROOMS } = require('./constants');

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, { cors: '*' });

const VIDEOS_CACHE = {
    // PARTY_ID:VIDEO
};

const PARTY_MESSAGES = {
    // PARTY_ID:{MESSAGE, USER}
};

/**
 * Authenticates a user socket connection
 */
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.headers.authorization;

    try {
        const res = await axios.get(PATHS['currentUser'], {
            ...DEFAULT_OPTIONS(token)
        });

        socket.user = { ...res.data.data.user };
        socket.token = token;

        next();
    } catch {
        return next(new Error(ERRORS['unauthenticated']));
    }

});

io.on('connection', (socket) => {
    console.log({ username: socket.user.username });

    socket.emit('user', { user: socket.user });

    socket.on('join-party', async (payload) => {
        payload.partyId = parseInt(payload.partyId);
        if (!payload || typeof payload.partyId !== 'number') {
            return socket.emit('exception', { message: ERRORS['invalid_payload'] });
        }

        res = null;

        try {
            res = await axios.get(PATHS['getParty'](payload.partyId), { ...DEFAULT_OPTIONS(socket.token) });
        } catch {

            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        const party = res.data.data;

        // Check if party is finished
        if (party.finished_at !== null) {
            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        if (party.owner.id !== socket.user.id && party.invite_code !== payload.invite_code) {
            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        // User is either owner or has correct invite code

        // We add them to party's stream channel
        socket.join(ROOMS.party_stream(party.id));

        // We add them to party's messages channel
        socket.join(ROOMS.party_messages(party.id));

        console.log({ event: 'join-party' });
        console.log({ partyId: payload.partyId });

        io.to(socket.id).emit('party-joined', { partyId: payload.partyId, videoUrl: VIDEOS_CACHE[payload?.partyId]?.url, video: VIDEOS_CACHE[payload?.partyId], messages: PARTY_MESSAGES[payload?.partyId] ?? [] });

        res = null;

        try {
            res = await axios.post(PATHS['addUserToParty'](payload.partyId), { user_id: socket.user.id }, { ...DEFAULT_OPTIONS(socket.token) });
        } catch (e) {
            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        const sockets = io.sockets.adapter.rooms.get(ROOMS.party_stream(payload.partyId));

        sockets.forEach((socketId) => {
            if (socketId === socket.id) {
                return;
            }

            io.to(socketId).emit('user-party-joined', { partyId: payload.partyId, user: socket.user });
        });

        return;
    });

    socket.on('message-send', ((payload) => {
        if (!socket.rooms.has(ROOMS.party_messages(payload?.partyId))) {
            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        if (PARTY_MESSAGES[payload?.partyId]) {
            PARTY_MESSAGES[payload?.partyId].push({ message: payload?.message, user: { ...socket.user } })
        } else {
            PARTY_MESSAGES[payload?.partyId] = [{ message: payload?.message, user: { ...socket.user } }]
        }

        return io.in(ROOMS.party_messages(payload.partyId)).emit('message-receive', { partyId: payload?.partyId, user: socket.user, message: payload?.message });
    }));

    socket.on('video-manage-send', (async (payload) => {
        if (!socket.rooms.has(ROOMS.party_stream(payload?.partyId))) {
            return socket.emit('exception', { message: ERRORS['party_not_found'] });
        }

        const sockets = io.sockets.adapter.rooms.get(ROOMS.party_stream(payload.partyId));

        switch (payload.action) {
            case 'pause':
                sockets.forEach((socketId) => {
                    if (socketId === socket.id) {
                        return;
                    }

                    io.to(socketId).emit('video-pause-receive', { partyId: payload?.partyId, action: 'pause' });
                });
                return
            case 'resume':
                sockets.forEach((socketId) => {
                    if (socketId === socket.id) {
                        return;
                    }

                    io.to(socketId).emit('video-resume-receive', { partyId: payload?.partyId, action: 'resume' });
                });
                return
            case 'seek':
                sockets.forEach((socketId) => {
                    if (socketId === socket.id) {
                        return;
                    }

                    io.to(socketId).emit('video-seek-receive', { partyId: payload?.partyId, action: 'seek', time: payload?.time });
                });
                return;
            case 'set_video':
                res = null;

                try {
                    res = await axios.get(PATHS['getVideo'](payload.videoId), { ...DEFAULT_OPTIONS(socket.token) });
                } catch {
                    return socket.emit('exception', { message: ERRORS['invalid_action'] });
                }

                const video = res.data.data;
                const videoUrl = res.data.data.url;

                VIDEOS_CACHE[payload?.partyId] = { ...video };

                return io.in(ROOMS.party_stream(payload.partyId)).emit('video-set-receive', { partyId: payload?.partyId, action: 'set_video', videoUrl, video });
            default:
                return socket.emit('exception', { message: ERRORS['invalid_action'] });
        }
    }));
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});