# PWA Push Notifications (Railway backend)

Push notifications for the PWA (e.g. "Time for devotions") are handled by your **Railway** worker. The Next.js app only requests permission and forwards the subscription to the worker.

## 1. Supabase

Run the SQL in **worker/supabase-push-subscriptions.sql** in your Supabase SQL Editor so the worker can store subscriptions.

## 2. VAPID keys

Generate a key pair once:

```bash
npx web-push generate-vapid-keys
```

- **Vercel:** Set `VAPID_PUBLIC_KEY` (public key only). Used by `GET /api/push/vapid-public` so the client can subscribe.
- **Railway:** Set both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (same pair). Used to send notifications.

## 3. Railway worker env

On your Railway worker service, set:

- `VAPID_PUBLIC_KEY` – same as in Vercel
- `VAPID_PRIVATE_KEY` – from the same `web-push generate-vapid-keys` run
- Supabase is already configured; the worker uses the same Supabase project and the `push_subscriptions` table.

## 4. Sending a notification

**Option A – Manual:** POST to your worker:

```bash
curl -X POST https://YOUR-WORKER.railway.app/push/send \
  -H "Content-Type: application/json" \
  -d '{"title":"fxarchives","body":"Time for devotions."}'
```

**Option B – Cron:** Use Railway cron or an external cron (e.g. cron-job.org) to call `POST https://YOUR-WORKER.railway.app/push/send` at the desired time (e.g. 8:00 AM).

The worker returns `{ success: true, sent: N, total: M }`. Subscriptions that return 410/404 are removed automatically.

## Flow

1. User taps "Enable notifications" in the app (devotions menu or prompt).
2. Browser asks for permission; if granted, the app registers `/sw.js`, gets the VAPID public key from `/api/push/vapid-public`, subscribes via the service worker, and POSTs the subscription to `/api/push/subscribe`.
3. Next.js forwards the subscription to `AUDIO_WORKER_URL/push/subscribe`; the worker stores it in Supabase.
4. When you call the worker’s `/push/send`, it sends to all stored subscriptions; the service worker receives the push and shows the notification (tap opens `/devotions`).
