'use strict';

// Standalone helper: prints the LAN IP address(es) this machine is reachable
// on, so you can double check what to share with housemates without having
// to start the whole server. Run with `npm run find-ip`.

const os = require('os');

const interfaces = os.networkInterfaces();
const addresses = [];

for (const [name, ifaceList] of Object.entries(interfaces)) {
  for (const iface of ifaceList || []) {
    if (iface.family === 'IPv4' && !iface.internal) {
      addresses.push({ name, address: iface.address });
    }
  }
}

if (addresses.length === 0) {
  console.log('No LAN IP address found. Are you connected to wifi/ethernet?');
} else {
  console.log('This machine is reachable on your local network at:');
  for (const { name, address } of addresses) {
    console.log(`  ${address}  (interface: ${name})`);
  }
}
