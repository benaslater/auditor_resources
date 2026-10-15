'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateIP, localNetworkOnly } = require('../src/lib/networkGuard');

test('isPrivateIP: accepts common private LAN ranges', () => {
  assert.equal(isPrivateIP('192.168.1.42'), true);
  assert.equal(isPrivateIP('10.0.0.5'), true);
  assert.equal(isPrivateIP('172.16.0.1'), true);
  assert.equal(isPrivateIP('172.31.255.255'), true);
  assert.equal(isPrivateIP('127.0.0.1'), true);
  assert.equal(isPrivateIP('169.254.1.1'), true);
});

test('isPrivateIP: accepts IPv6 loopback, link-local and unique-local', () => {
  assert.equal(isPrivateIP('::1'), true);
  assert.equal(isPrivateIP('fe80::1'), true);
  assert.equal(isPrivateIP('fd12:3456:789a::1'), true);
});

test('isPrivateIP: unwraps IPv4-mapped IPv6 addresses', () => {
  assert.equal(isPrivateIP('::ffff:192.168.1.5'), true);
  assert.equal(isPrivateIP('::ffff:8.8.8.8'), false);
});

test('isPrivateIP: rejects public addresses', () => {
  assert.equal(isPrivateIP('8.8.8.8'), false);
  assert.equal(isPrivateIP('1.1.1.1'), false);
  assert.equal(isPrivateIP('172.32.0.1'), false); // just outside 172.16.0.0/12
  assert.equal(isPrivateIP('172.15.255.255'), false); // just outside the other end
});

test('isPrivateIP: rejects garbage input', () => {
  assert.equal(isPrivateIP(''), false);
  assert.equal(isPrivateIP(null), false);
  assert.equal(isPrivateIP('not-an-ip'), false);
  assert.equal(isPrivateIP('999.999.999.999'), false);
});

test('localNetworkOnly: calls next() for a private-network request', () => {
  const req = { socket: { remoteAddress: '192.168.0.10' } };
  let called = false;
  const res = { status() { return this; }, send() {} };
  localNetworkOnly(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('localNetworkOnly: responds 403 for a public-network request', () => {
  const req = { socket: { remoteAddress: '8.8.8.8' } };
  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    send() {}
  };
  localNetworkOnly(req, res, () => { throw new Error('next() should not be called'); });
  assert.equal(statusCode, 403);
});
