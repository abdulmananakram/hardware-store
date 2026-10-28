# Hardware Shop POS

Mobile-first, single-shop hardware-store POS for a shop PC and phone on the same Wi-Fi network.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Zustand for the client UI state
- Prisma 6 with SQLite for transactional persistence
- Zod request validation
- Jest and TypeScript-aware linting

## Install and configure

```powershell
npm install
Copy-Item .env.example .env
npx prisma generate
npm run db:push
```

Set `APP_PIN` in `.env` before starting the application. The default in `.env.example` is only a development example; use a private PIN for the shop.

## Run

```powershell
npm run build
npm start
```

The server listens on port 3000. Find the PC's LAN IP with `ipconfig`, then open `http://<PC-LAN-IP>:3000` on the phone while both devices are connected to the same Wi-Fi network.

For development, use `npm run dev`.

## Database and backups

The SQLite database is `db/custom.db` (configured by `DATABASE_URL`). Create a SQLite-safe backup with:

```powershell
npm run backup
```

Backups are written to `backups/` and the newest 30 are retained. To restore, stop the app, keep a copy of the current database, replace `db/custom.db` with a selected backup, then run `npm run db:push` before starting the app again.

`npm run db:seed` is optional and only creates the default shop configuration. It is never run automatically and does not add demo business data.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```
