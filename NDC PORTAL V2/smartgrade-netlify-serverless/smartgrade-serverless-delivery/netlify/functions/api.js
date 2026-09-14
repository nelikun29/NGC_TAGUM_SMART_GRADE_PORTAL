require('dotenv').config();
const path = require('path');
const express = require('express');
const serverless = require('serverless-http');
const apiRouter = require(path.join(__dirname, '..', '..', 'backend', 'api-router'));

const app = express();

// Netlify's edge network always sits in front of this function — always
// trust its forwarded-for header so audit logs and rate limiting see the
// real visitor IP.
app.set('trust proxy', 1);

// The redirect in netlify.toml sends /api/* here as
// /.netlify/functions/api/*, so the router is mounted at that same path —
// this keeps this file as the ONLY place that needs to know about that
// Netlify-specific path shape.
app.use('/.netlify/functions/api', apiRouter);

exports.handler = serverless(app);
