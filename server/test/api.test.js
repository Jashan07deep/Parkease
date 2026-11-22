// Integration tests: run against the database in .env (run `npm run db:init` first; it wipes data).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.ADMIN_PIN = 'test-pin';
const app = require('../app');
const pool = require('../db/pool');

let server, base, adminToken;
const call = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};
const admin = () => ({ 'x-admin-token': adminToken });
const as = (t) => ({ authorization: `Bearer ${t}` });
const tokens = {};
const signup = async (id, name) => {
  const r = await call('POST', '/auth/register', { studentId: id, fullName: name, password: 'secret1' });
  assert.equal(r.status, 201); tokens[id] = r.data.token; return r.data.token;
};

before(async () => {
  for (const t of ['sessions', 'bookings', 'parking_slots', 'parking_zones', 'students']) await pool.query(`DELETE FROM ${t}`);
  server = app.listen(0); base = `http://localhost:${server.address().port}/api`;
});
after(async () => { server.close(); await pool.end(); });

test('admin login rejects bad PIN, accepts good PIN', async () => {
  assert.equal((await call('POST', '/admin/login', { pin: 'nope' })).status, 401);
  const ok = await call('POST', '/admin/login', { pin: 'test-pin' });
  assert.equal(ok.status, 200); adminToken = ok.data.token;
});

test('registration: validation, duplicates, hashed storage', async () => {
  assert.equal((await call('POST', '/auth/register', { studentId: 'AB', fullName: 'X', password: 'secret1' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { studentId: 'WEAK1', fullName: 'X', password: '123' })).status, 400);
  await signup('STU1', 'Asha');
  const dup = await call('POST', '/auth/register', { studentId: 'stu1', fullName: 'Thief', password: 'other-pass' });
  assert.equal(dup.status, 409);
  const [[row]] = await pool.query("SELECT password_hash FROM students WHERE student_id='STU1'");
  assert.ok(row.password_hash.includes(':') && !row.password_hash.includes('secret1'));
});

test('login: wrong password and unknown ID get the same rejection', async () => {
  const wrong = await call('POST', '/auth/login', { studentId: 'STU1', password: 'not-it' });
  const unknown = await call('POST', '/auth/login', { studentId: 'NOBODY', password: 'secret1' });
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.equal(wrong.data.error, unknown.data.error);
  const ok = await call('POST', '/auth/login', { studentId: 'stu1', password: 'secret1' });
  assert.equal(ok.status, 200); assert.equal(ok.data.student.fullName, 'Asha');
  assert.equal((await call('GET', '/auth/me', null, as(ok.data.token))).status, 200);
  assert.equal((await call('GET', '/auth/me', null, as('bogus'))).status, 401);
});

test('repeated wrong passwords lock the login', async () => {
  await signup('LOCKME', 'Lock');
  let last;
  for (let i = 0; i < 9; i++) last = await call('POST', '/auth/login', { studentId: 'LOCKME', password: 'bad' + i });
  assert.equal(last.status, 429);
  assert.equal((await call('POST', '/auth/login', { studentId: 'LOCKME', password: 'secret1' })).status, 429);
});

test('logout invalidates the token', async () => {
  const t = (await call('POST', '/auth/login', { studentId: 'STU1', password: 'secret1' })).data.token;
  await call('POST', '/auth/logout', null, as(t));
  assert.equal((await call('GET', '/auth/me', null, as(t))).status, 401);
});

test('spot management needs admin', async () => {
  assert.equal((await call('POST', '/slots', { name: 'A-01', lat: 28.2, lng: 77.06 })).status, 401);
});

let zoneId, a1, a2, tw;
test('admin creates zone and named spots; duplicate names rejected', async () => {
  zoneId = (await call('POST', '/zones', { name: 'Main Gate' }, admin())).data.id;
  a1 = (await call('POST', '/slots', { name: 'A-01', zoneId, lat: 28.2488, lng: 77.0634 }, admin())).data.id;
  a2 = (await call('POST', '/slots', { name: 'A-02', zoneId, lat: 28.24882, lng: 77.06342, vehicleType: 'Four-wheeler' }, admin())).data.id;
  tw = (await call('POST', '/slots', { name: 'B-01', lat: 28.2489, lng: 77.0635, vehicleType: 'Two-wheeler' }, admin())).data.id;
  assert.equal((await call('POST', '/slots', { name: 'A-01', lat: 28.2, lng: 77.0 }, admin())).status, 409);
  assert.equal((await call('POST', '/slots', { name: 'X', lat: 999, lng: 0 }, admin())).status, 400);
});

test('booking needs sign-in and enforces the rules', async () => {
  const t1 = await signup('STU2', 'Ben'); await signup('STU3', 'Cy');
  const body = (slotId, type = 'Four-wheeler') => ({ slotId, vehicleNo: 'hr 29 ab 1', vehicleType: type });
  assert.equal((await call('POST', '/bookings', body(a1))).status, 401);

  const t0 = tokens.STU1 = (await call('POST', '/auth/login', { studentId: 'STU1', password: 'secret1' })).data.token;
  assert.equal((await call('POST', '/bookings', body(a1), as(t0))).status, 201);
  assert.equal((await call('POST', '/bookings', body(a1), as(t1))).status, 409);              // spot taken
  const second = await call('POST', '/bookings', body(a2), as(t0));                            // second spot, same student
  assert.equal(second.status, 409); assert.match(second.data.error, /already have an active booking/);
  assert.equal((await call('POST', '/bookings', body(tw), as(t1))).status, 409);              // wrong vehicle type

  const slots = (await call('GET', '/slots', null, as(t0))).data;
  const s = slots.find((x) => x.id === a1);
  assert.equal(s.status, 'Booked'); assert.equal(s.mine, true); assert.equal(s.bookedBy, undefined);
  assert.equal((await call('GET', '/slots', null, as(t1))).data.find((x) => x.id === a1).mine, false);
});

test('students only see their own bookings; only the owner can cancel', async () => {
  const mine = await call('GET', '/bookings', null, as(tokens.STU1));
  assert.equal(mine.data.length, 1);
  assert.equal((await call('GET', '/bookings', null, as(tokens.STU2))).data.length, 0);
  assert.equal((await call('GET', '/bookings')).status, 401);
  assert.equal((await call('GET', '/bookings?all=1', null, as(tokens.STU2))).data.length, 0, 'students cannot list everyone');

  const id = mine.data[0].id;
  assert.equal((await call('POST', `/bookings/${id}/cancel`, null, as(tokens.STU2))).status, 403);
  assert.equal((await call('POST', `/bookings/${id}/cancel`)).status, 401);
  assert.equal((await call('POST', `/bookings/${id}/cancel`, null, as(tokens.STU1))).status, 200);
  assert.equal((await call('POST', `/bookings/${id}/cancel`, null, as(tokens.STU1))).status, 409);
  assert.equal((await call('GET', '/slots')).data.find((x) => x.id === a1).status, 'Available');
});

test('concurrent bookings for one spot: exactly one wins', async () => {
  const ids = ['C1X', 'C2X', 'C3X', 'C4X'];
  for (const id of ids) await signup(id, id);
  const results = await Promise.all(ids.map((id) =>
    call('POST', '/bookings', { slotId: a1, vehicleNo: 'V' + id, vehicleType: 'Four-wheeler' }, as(tokens[id]))));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 3);
});

test('maintenance blocks booking; booked spot cannot be deleted; history survives delete', async () => {
  assert.equal((await call('PUT', `/slots/${a2}`, { name: 'A-02', zoneId, lat: 28.24882, lng: 77.06342, vehicleType: 'Four-wheeler', state: 'Maintenance' }, admin())).status, 200);
  assert.equal((await call('POST', '/bookings', { slotId: a2, vehicleNo: 'X', vehicleType: 'Four-wheeler' }, as(tokens.STU3))).status, 409);
  assert.equal((await call('DELETE', `/slots/${a1}`, null, admin())).status, 409);
  assert.equal((await call('DELETE', `/slots/${a2}`, null, admin())).status, 200);
  assert.equal((await call('GET', '/bookings', null, as(tokens.STU1))).data[0].slotName, 'A-01');
});

test('zone counts, owner visibility and admin stats', async () => {
  const z = (await call('GET', '/zones')).data.find((x) => x.id === zoneId);
  assert.equal(z.total, 1); assert.equal(z.booked, 1); assert.equal(z.available, 0);
  assert.ok((await call('GET', '/slots')).data.every((s) => s.bookedBy === undefined));
  assert.ok((await call('GET', '/slots', null, admin())).data.some((s) => s.bookedBy));
  assert.equal((await call('GET', '/admin/stats')).status, 401);
  const st = (await call('GET', '/admin/stats', null, admin())).data;
  assert.equal(st.active, 1); assert.ok(st.students >= 5); assert.ok(st.perDay.length >= 1);
});

test('password change needs the current password and signs out other devices', async () => {
  const other = (await call('POST', '/auth/login', { studentId: 'STU2', password: 'secret1' })).data.token;
  assert.equal((await call('PUT', '/auth/password', { currentPassword: 'wrong', newPassword: 'newpass1' }, as(tokens.STU2))).status, 403);
  assert.equal((await call('PUT', '/auth/password', { currentPassword: 'secret1', newPassword: 'newpass1' }, as(tokens.STU2))).status, 200);
  assert.equal((await call('GET', '/auth/me', null, as(other))).status, 401);
  assert.equal((await call('GET', '/auth/me', null, as(tokens.STU2))).status, 200);
  assert.equal((await call('POST', '/auth/login', { studentId: 'STU2', password: 'newpass1' })).status, 200);
});

test('pre-password accounts can be claimed once', async () => {
  await pool.query("INSERT INTO students (student_id, full_name) VALUES ('LEGACY1', 'Old Account')");
  assert.equal((await call('POST', '/auth/login', { studentId: 'LEGACY1', password: 'anything' })).status, 401);
  assert.equal((await call('POST', '/auth/register', { studentId: 'LEGACY1', fullName: 'Old Account', password: 'claimed1' })).status, 201);
  assert.equal((await call('POST', '/auth/register', { studentId: 'LEGACY1', fullName: 'Thief', password: 'stolen11' })).status, 409);
});
