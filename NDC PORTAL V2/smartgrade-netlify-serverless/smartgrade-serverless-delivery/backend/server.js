require('dotenv').config();
const express = require('express');
const apiRouter = require('./api-router');

const app = express();

// Only trust the proxy's forwarded-for header if you've actually deployed
// this behind a reverse proxy you control (see README/DEPLOYMENT.md) —
// never enable this if the app is directly exposed, since a client could
// then spoof their own IP via that header.
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use('/api', apiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Smart Grade backend (local dev) listening on port ${PORT}`));

module.exports = app;
