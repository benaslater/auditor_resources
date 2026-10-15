'use strict';

/**
 * Determines whether an IP address is "local" in the sense of belonging to a
 * private LAN (RFC1918 / RFC4193), loopback, or link-local range - i.e. the
 * kind of address a device on the same home wifi network would have.
 *
 * This is a defense-in-depth check, not a substitute for not port-forwarding
 * the server's port on your router. See README.md for the full picture.
 */
function isPrivateIP(rawIp) {
  if (!rawIp) return false;

  let ip = rawIp;
  // Express with "trust proxy" off still gives addresses like ::ffff:192.168.1.5
  // for IPv4 clients on a dual-stack socket - unwrap that prefix.
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  // IPv6 loopback and unique-local / link-local ranges.
  if (ip === '::1') return true;
  if (/^fe80:/i.test(ip)) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true; // unique local fc00::/7

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;

  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local

  return false;
}

/**
 * Express middleware that rejects requests whose remote address is not on a
 * private/local network. Trusts req.socket.remoteAddress directly (does not
 * honour X-Forwarded-For) so it can't be spoofed by a client header.
 */
function localNetworkOnly(req, res, next) {
  const remoteAddress = req.socket && req.socket.remoteAddress;
  if (isPrivateIP(remoteAddress)) {
    return next();
  }
  res.status(403).send('Forbidden: this app is only accessible from the local network.');
}

module.exports = { isPrivateIP, localNetworkOnly };
