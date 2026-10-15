# Shared Resources Planner

A small web app for a shared house to coordinate who's using the shower,
kitchen, and other shared resources — and when. Instead of a hallway
"is anyone in there?", housemates can post things like:

- "I leave for work at 8, so I'd like the shower between 7 and 8 every weekday."
- "Cooking for friends in the kitchen next Tuesday, 17:00–19:00."

Everyone sees a weekly calendar per resource, and the app warns you (without
blocking you) if you try to book a slot someone else already has.

It runs entirely from one housemate's laptop — no cloud hosting, no
accounts, no cost. Everyone else connects to it over the house wifi using a
web browser.

---

## 1. One-time setup

You'll need [Node.js](https://nodejs.org/) (the LTS version) installed on
the laptop that will host the app. To check if you already have it, open a
terminal and run:

```
node --version
```

If that prints a version number (v20 or higher), you're set. If not,
download and install it from nodejs.org first.

### Edit `data/config.json`

Open [data/config.json](data/config.json) and replace the placeholder names
and resources with your own house's. For example:

```json
{
  "houseName": "12 Example Street",
  "resources": [
    { "id": "shower", "name": "Shower Room", "color": "#2563eb" },
    { "id": "kitchen", "name": "Kitchen", "color": "#d97706" }
  ],
  "users": ["Alice", "Ben", "Carla", "Dev", "Elin", "Femi", "Grace"]
}
```

- `resources` — add, remove, or rename shared spaces (shower, kitchen,
  washing machine, lounge, driveway parking spot, whatever you actually
  share). Each `id` must be unique and use only letters/numbers/hyphens; the
  `color` is used to highlight that resource's tab.
- `users` — the list of housemates. People pick their name from a dropdown
  in the app; there are no passwords, since the app is only reachable from
  your own wifi.

Save the file. No restart is needed if the server isn't running yet; if it's
already running, restart it (Ctrl+C, then start again) to pick up changes.

---

## 2. Starting the app

From the project folder, run the start script for your OS:

**macOS / Linux:**
```
./scripts/start.sh
```

**Windows:** double-click `scripts\start.bat`, or run it from a terminal.

The first run installs dependencies automatically (needs an internet
connection, once). After that it starts instantly, even offline.

You'll see something like:

```
  12 Example Street is running.

  On this laptop:   http://localhost:3000
  On the wifi:      http://192.168.1.42:3000

  Share the "On the wifi" address with your housemates (same network only).
  Press Ctrl+C to stop.
```

Send the "On the wifi" address to your housemates (house group chat, a
sticky note by the kettle, whatever works). They open it in any browser on a
phone, tablet, or laptop **connected to the same wifi network**.

If you ever forget the address, run `npm run find-ip` to print it again
without starting the whole server.

To stop the app, go back to the terminal window and press `Ctrl+C`. Bookings
are saved to disk (`data/bookings.json`), so nothing is lost - the calendar
picks up where it left off next time you start the app.

### Keeping it running

The app only works while that terminal window is open and the laptop is
awake and connected to wifi. For a shared house, it's usually easiest to
just start it in the morning and leave the laptop's lid open, or plugged in
with sleep disabled, on whichever day someone's around to host it. There's
no requirement that it runs 24/7 — housemates can post bookings whenever
it's up, same as any household whiteboard.

---

## 3. Using the app

- **Pick your name** from the dropdown at the top. This is remembered on
  each device (via the browser's local storage), so you shouldn't need to
  reselect it every time on your own phone/laptop.
- **Switch resources** using the tabs (Shower Room, Kitchen, etc.).
- **Browse weeks** with the Prev/Next/Today buttons above the calendar.
- **Add a booking** with "+ New booking":
  - *One-off date* — for a single occasion, like cooking for friends next
    Tuesday.
  - *Repeats weekly* — for a standing slot, like a daily work shower. Tick
    the days it applies to, and optionally set a start/end date (leave
    blank for "until further notice" — you can always delete it later).
  - Add a short note if it helps (e.g. "big meal for 6 people").
- **Conflicts**: if your slot overlaps someone else's on the same resource,
  you'll see who and when before saving. You can still book anyway (life
  happens), but it's a nudge to go talk to them first.
- **Delete a booking** with the × on its calendar block, or from "My
  upcoming bookings" below the calendar. You can only delete your own
  bookings.

---

## 4. How the network restriction works

The app binds to your laptop's network so it's reachable from other devices
on the same wifi, but it also checks the IP address of every request and
**rejects anything that isn't on a private/local network** (the
`192.168.x.x`, `10.x.x.x`, and `172.16-31.x.x` ranges that home routers use,
plus `localhost`). See [src/lib/networkGuard.js](src/lib/networkGuard.js).

This is a real safeguard, but it's not a substitute for good router
hygiene - it stops a random request from the open internet from reaching the
app, but it can't stop someone already on your wifi (e.g. a guest network,
if your router bridges it) from using it. For the level of privacy a house
booking calendar needs, this is normally more than enough. A couple of
things to double check on your end:

- **Don't port-forward** the app's port (3000 by default) on your router.
  Nothing in this project sets that up, but it's worth confirming your
  router doesn't have UPnP silently doing it for you.
- If your router has a separate **guest wifi network**, it's often isolated
  from your main network by design (worth checking) - that's a feature, not
  a bug, if you don't want guests reaching the app.
- The app has no login and no per-user permissions beyond "you can only
  delete your own bookings" - anyone on your wifi who has the link can view
  and create bookings under any housemate's name. That's an intentional
  trade-off for a same-house tool; don't reuse this for anything sensitive.

---

## 5. Running the tests

The project has an automated test suite covering booking validation,
conflict detection, recurring-booking expansion, the network guard, the
JSON data store, and the HTTP API end-to-end.

```
npm install   # first time only
npm test
```

You should see all tests pass (`# pass N`, `# fail 0`).

---

## 6. Project structure

```
server.js                 Entry point: starts the HTTP server
src/app.js                Express app (routes, middleware) - reusable in tests
src/store.js              JSON-file-backed storage for bookings
src/config.js             Loads data/config.json
src/lib/recurrence.js     Expands recurring bookings into concrete dates
src/lib/conflicts.js      Finds overlapping bookings between users
src/lib/validate.js       Validates booking input from the API
src/lib/networkGuard.js   Restricts access to private/local network addresses
src/routes/               Express route handlers
data/config.json          House name, resources, and housemate names (edit this!)
data/bookings.json        All bookings - the app's "database" (auto-created/updated)
public/                   Frontend: plain HTML/CSS/JS, no build step
test/                     Automated test suite (node:test + supertest)
scripts/start.sh          Start script for macOS/Linux
scripts/start.bat         Start script for Windows
scripts/find-ip.js        Prints your LAN IP address on its own
```

---

## 7. Troubleshooting

**"Port 3000 is already in use"** — another program is using that port.
Start the app on a different port instead:
```
PORT=3001 npm start        # macOS/Linux
set PORT=3001 && npm start # Windows
```

**Housemates can't connect** — check that:
1. Their device is on the same wifi network as the host laptop (not mobile
   data, not a guest network if it's isolated).
2. You shared the "On the wifi" address, not `localhost`.
3. The host laptop's firewall isn't blocking incoming connections on that
   port (macOS/Windows will usually prompt you to allow it the first time
   the server starts - accept that prompt).

**Starting fresh / clearing all bookings** — stop the app and either delete
`data/bookings.json` or replace its contents with `{"bookings": []}`. A new
empty file is created automatically if it's missing.

**I want to change the calendar's colors, hours shown, etc.** — the frontend
is plain HTML/CSS/JS in `public/`, no build step required; edit and refresh
the browser.
