'use strict';

const path = require('path');
const os = require('os');
const { createApp } = require('./src/app');
const { Store } = require('./src/store');
const { loadConfig } = require('./src/config');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');
const BOOKINGS_PATH = path.join(__dirname, 'data', 'bookings.json');

function localNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const ifaceList of Object.values(interfaces)) {
    for (const iface of ifaceList || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function main() {
  const config = loadConfig(CONFIG_PATH);
  const store = new Store(BOOKINGS_PATH);
  const app = createApp(store, config);

  app.listen(PORT, '0.0.0.0', () => {
    const addresses = localNetworkAddresses();
    console.log('');
    console.log(`  ${config.houseName || 'Shared Resources Planner'} is running.`);
    console.log('');
    console.log(`  On this laptop:   http://localhost:${PORT}`);
    if (addresses.length > 0) {
      for (const addr of addresses) {
        console.log(`  On the wifi:      http://${addr}:${PORT}`);
      }
    } else {
      console.log('  Could not detect a LAN IP address - make sure you are connected to wifi.');
    }
    console.log('');
    console.log('  Share the "On the wifi" address with your housemates (same network only).');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });
}

main();
