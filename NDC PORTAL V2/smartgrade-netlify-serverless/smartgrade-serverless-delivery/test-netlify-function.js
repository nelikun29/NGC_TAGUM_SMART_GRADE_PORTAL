// Simulates how Netlify actually invokes the function, to verify the
// serverless-http wrapper + path mounting works, without needing a real
// Netlify deployment. Run with: node test-netlify-function.js
require('dotenv').config();
const { handler } = require('./netlify/functions/api');

function makeEvent({ path, httpMethod = 'GET', headers = {}, body = null }) {
  return {
    path,
    httpMethod,
    // Netlify always includes the visitor's real IP in this header — this
    // is exactly what a real invocation looks like, unlike a bare mock.
    headers: { 'x-nf-client-connection-ip': '203.0.113.42', ...headers },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    requestContext: { identity: { sourceIp: '203.0.113.42' } },
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
  };
}

async function run() {
  console.log('--- Test 1: health check via simulated Netlify path ---');
  const healthRes = await handler(makeEvent({ path: '/.netlify/functions/api/health' }), {});
  console.log('status:', healthRes.statusCode, 'body:', healthRes.body);

  console.log('\n--- Test 2: config endpoint ---');
  const configRes = await handler(makeEvent({ path: '/.netlify/functions/api/config' }), {});
  console.log('status:', configRes.statusCode, 'body:', configRes.body);

  console.log('\n--- Test 3: login (POST with body + headers) ---');
  const loginRes = await handler(makeEvent({
    path: '/.netlify/functions/api/auth/login',
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { email: 'prof.delacruz@portal.edu', password: 'Teacher!2345' },
  }), {});
  console.log('status:', loginRes.statusCode, 'body:', loginRes.body.slice(0, 150));

  const token = JSON.parse(loginRes.body).token;

  console.log('\n--- Test 4: authenticated request (list classes) ---');
  const classesRes = await handler(makeEvent({
    path: '/.netlify/functions/api/classes',
    headers: { authorization: `Bearer ${token}` },
  }), {});
  console.log('status:', classesRes.statusCode, 'body:', classesRes.body.slice(0, 200));

  console.log('\n--- Test 5: no token (should be 401) ---');
  const noAuthRes = await handler(makeEvent({ path: '/.netlify/functions/api/admin/dashboard' }), {});
  console.log('status:', noAuthRes.statusCode, 'body:', noAuthRes.body);

  process.exit(0);
}

run().catch(e => { console.error('TEST HARNESS ERROR:', e); process.exit(1); });
