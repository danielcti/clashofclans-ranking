const axios = require('axios');

const api = axios.create({
    baseURL: 'https://api.clashofclans.com/v1',
});

module.exports = api;