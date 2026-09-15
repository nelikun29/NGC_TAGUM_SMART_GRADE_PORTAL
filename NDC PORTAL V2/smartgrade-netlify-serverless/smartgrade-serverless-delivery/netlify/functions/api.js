require('dotenv').config();

const path = require('path');
const express = require('express');
const serverless = require('serverless-http');

const apiRouter = require(
  path.join(__dirname, '..', '..', 'backend', 'api-router')
);

const app = express();

app.set('trust proxy', 1);

// Parse JSON request bodies
app.use(express.json());

// Mount the API router at root.
// Netlify handles /api/* → /.netlify/functions/api/*
// before the request reaches this function.
app.use('/', apiRouter);

exports.handler = serverless(app);
