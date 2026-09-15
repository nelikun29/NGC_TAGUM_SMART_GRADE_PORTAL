require('dotenv').config();

const path = require('path');
const express = require('express');
const serverless = require('serverless-http');

const apiRouter = require(
  path.join(__dirname, '..', '..', 'backend', 'api-router')
);

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

// Support both:
// /.netlify/functions/api/*
// and
// /api/*
app.use('/.netlify/functions/api', apiRouter);
app.use('/api', apiRouter);

exports.handler = serverless(app);
