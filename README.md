# ParkEase

Campus parking reservation system. Admins place and name parking spots on a satellite map; students book a spot from the map.

**Stack:** React 19 + Vite + Leaflet · Node.js + Express 5 · MySQL (or MariaDB)

## Run it

```bash
# 1. Database + API
cd server
cp .env.example .env        # then put your MySQL password and an ADMIN_PIN in .env
npm install
npm run db:init             # NEW database: creates parkease_db and its tables (wipes them if they exist!)
# npm run db:migrate        # EXISTING database from the previous version: adds passwords, keeps all your data
npm start                   # http://localhost:5000

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

## Using it

- **Students** create an account (student ID + password) and sign in. Wrong ID or password is rejected, and 8 wrong tries lock that login for 10 minutes. Then pick a green spot on the map (or from the list) and book it. One active booking per student.
- **Admins** open *Manage spots*, enter the `ADMIN_PIN`, then:
  - *Place a new spot*, click the map, type the name (`A-01`). The next name is pre-filled (`A-02`) so you can drop a whole row quickly.
  - Select a spot to rename it, set its zone and allowed vehicle type, close it for maintenance, or delete it. Drag the selected spot to move it.
  - *Zones* groups spots (e.g. Main gate); *Bookings* shows who holds what and lets you release a spot.
- Zoom in to street level to see spot names on the map; zoomed out, spots show as dots.

## Map imagery

Satellite tiles come from Esri. They have no real imagery past a certain zoom level in some areas (you'd see "Map data not available"), so the app stops requesting tiles at zoom 18 and stretches that level when you zoom closer. If you still see the grey message, set `VITE_SAT_NATIVE_ZOOM=17` in `client/.env` and restart `npm run dev`. The Streets layer (top-right layer button) always has detail.

## Security notes

Passwords are hashed with scrypt (per-user salt), sessions are random tokens stored hashed in the `sessions` table, and booking or cancelling always uses the signed-in student, never an ID sent by the browser. Admin tools need `ADMIN_PIN`. Use HTTPS if you ever deploy this beyond localhost.

## Database design

`students` · `sessions` · `parking_zones` · `parking_slots` · `bookings` (see `server/db/schema.sql`).

Booking rules are enforced by the database, not only by the app: `bookings` has generated columns `active_slot` and `active_student`, each with a UNIQUE key. MySQL therefore refuses a second *Active* booking on the same spot or for the same student, even if two requests arrive at once. The booking endpoint also takes a row lock (`SELECT … FOR UPDATE`) inside a transaction. A spot's "Booked" status is derived from its active booking and is never stored, so it cannot drift out of sync.

## Tests

```bash
cd server && npm run db:init && npm test   # WARNING: wipes the tables in the DB from .env
```
