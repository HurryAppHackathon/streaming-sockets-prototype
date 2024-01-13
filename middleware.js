const { default: axios } = require('axios');
const { PATHS, ERRORS, DEFAULT_OPTIONS } = require('./constants');

/**
 * Authenticates a user socket connection
 */
const authenticateUser = async (socket, next) => {
    const token = socket.handshake.auth.token;

    const res = await axios.get(PATHS['currentUser'], {
        ...DEFAULT_OPTIONS(token)
    });

    if (res.status !== 200) {
        return next(new Error(ERRORS['unauthenticated']));
    }


    socket.user = { ...res.data.data.user };

    next();
};

module.exports = { authenticateUser };