const SERVER_URL = 'http://127.0.0.1:40000';

const DEFAULT_OPTIONS = (token) => ({
    headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
    }
});

const ERRORS = {
    'unauthenticated': 'Unauthenticated.',
    'invalid_payload': 'Invalid Payload!',
    'party_not_found': 'Party not found!',
    'invalid_action': 'Invalid action!',
};

const PATHS = {
    'currentUser': `${SERVER_URL}/api/v1/auth/@me`,
    'getParty': (partyId) => `${SERVER_URL}/api/v1/parties/${partyId}`,
    'getVideo': (videoId) => `${SERVER_URL}/api/v1/videos/${videoId}`,
    'addUserToParty': (partyId) => `${SERVER_URL}/api/v1/parties/${partyId}/users`,
}

const ROOMS = {
    'party_stream': (partyId) => `parties.${partyId}.stream`,
    'party_messages': (partyId) => `parties.${partyId}.messages`,
}


module.exports = { SERVER_URL, DEFAULT_OPTIONS, ERRORS, PATHS, ROOMS };