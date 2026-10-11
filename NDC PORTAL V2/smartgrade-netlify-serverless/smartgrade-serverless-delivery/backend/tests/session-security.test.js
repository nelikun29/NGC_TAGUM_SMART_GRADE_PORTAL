// Run with: node --test backend/tests/session-security.test.js
// Uses in-memory stubs only; does not connect to a database.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const middlewarePath = path.resolve(__dirname, '../middleware/auth.js');

function loadMiddleware({ sessionVersion = 0, revoked = false } = {}) {
  const originalLoad = Module._load;
  process.env.JWT_SECRET = 'test-only-secret';
  const queries = [];
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === middlewarePath && request === 'jsonwebtoken') {
      return { verify: token => {
        if (token === 'invalid') throw new Error('bad token');
        return { sub: 'student-1', exp: Math.floor(Date.now()/1000)+3600, sv: token === 'old' ? 0 : 1 };
      }};
    }
    if (parent?.filename === middlewarePath && request === '../db') {
      return { pool: { query: async (sql, args) => {
        queries.push({sql,args});
        if (sql.includes('revoked_sessions')) return { rows: revoked ? [{exists:1}] : [] };
        return { rows: [{ id:'student-1', role:'student', email:'test@example.invalid', is_active:true, approval_status:'approved', account_verification_status:'verified', session_version:sessionVersion }] };
      } } };
    }
    return originalLoad.apply(this, arguments);
  };
  try { delete require.cache[middlewarePath]; return { middleware:require(middlewarePath), queries }; }
  finally { Module._load = originalLoad; delete require.cache[middlewarePath]; }
}
async function request(middleware, token) {
  const result = { statusCode:200, body:null, next:false };
  const req = {headers:{authorization:'Bearer '+token}};
  const res = { status(code){result.statusCode=code;return this;},json(body){result.body=body;return this;} };
  await middleware.authenticate(req,res,()=>{result.next=true;});
  result.user = req.user;
  result.sessionSecurity = req.sessionSecurity;
  return result;
}
test('current session version authenticates',async()=>{
  const {middleware}=loadMiddleware({sessionVersion:1});
  assert.equal((await request(middleware,'current')).next,true);
});
test('older token is rejected after password reset',async()=>{
  const {middleware}=loadMiddleware({sessionVersion:1});
  assert.equal((await request(middleware,'old')).statusCode,401);
});
test('revoked token is rejected',async()=>{
  const {middleware}=loadMiddleware({sessionVersion:1,revoked:true});
  assert.equal((await request(middleware,'current')).statusCode,401);
});
test('invalid token is rejected before database access',async()=>{
  const {middleware,queries}=loadMiddleware({sessionVersion:1});
  assert.equal((await request(middleware,'invalid')).statusCode,401);
  assert.equal(queries.length,0);
});

test('revocation metadata is not exposed in user profile',async()=>{
  const {middleware}=loadMiddleware({sessionVersion:1});
  const result=await request(middleware,'current');
  assert.equal(result.next,true);
  assert.equal(Object.hasOwn(result.user,'sessionTokenHash'),false);
  assert.equal(Object.hasOwn(result.user,'sessionExpiresAt'),false);
  assert.match(result.sessionSecurity.tokenHash,/^[a-f0-9]{64}$/);
  assert.ok(result.sessionSecurity.expiresAt instanceof Date);
});
