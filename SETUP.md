# Admin and Auth Setup

## Where passwords live

Passwords are **not** stored in your app database. They are managed by **Supabase Auth** (`auth.users`). The app only stores:

- In **Supabase Auth**: user accounts (email, hashed password, etc.)
- In your **`profiles`** table: `user_id`, `email`, `role` (e.g. `member` or `admin`)

The admin login page uses Supabase’s `signInWithPassword` (email + password). No password column exists in `profiles`, and that’s correct.

## Creating the first admin

### Option A: Manual (Supabase Dashboard + SQL)

1. **Create a user in Supabase**
   - Supabase Dashboard → **Authentication** → **Users** → **Add user** (or **Invite**).
   - Set email and password. Note the user’s **UUID** (or leave the tab open).

2. **Give that user the admin role**
   - Supabase Dashboard → **SQL Editor** → New query.
   - Run (replace with the user’s UUID or email as needed):

   ```sql
   -- By user ID (from Authentication → Users)
   INSERT INTO public.profiles (user_id, email, role)
   VALUES ('<paste-user-uuid-here>', 'your@email.com', 'admin')
   ON CONFLICT (user_id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
   ```

   Or if the trigger already created a `profiles` row when the user was created:

   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```

3. **Sign in** at `/admin/login` with that email and password.

### Option B: FIRST_ADMIN_EMAIL (recommended)

1. **Create a user in Supabase**
   - Supabase Dashboard → **Authentication** → **Users** → **Add user**.
   - Set the email and password you want to use for the first admin.

2. **Set env**
   - In `.env.local` (or your deployment env), set:
   ```bash
   FIRST_ADMIN_EMAIL=your@email.com
   ```
   Use the **exact** email you used when creating the user (case-insensitive).

3. **Sign in once**
   - Go to `/admin/login` and sign in with that user’s email and password.
   - On the first request after login, the app checks: if there is no existing admin and the signed-in user’s email matches `FIRST_ADMIN_EMAIL`, it promotes that user to `admin` in `profiles`.
   - You are now an admin; Sync Catalog and other admin actions will work.

After the first admin exists, `FIRST_ADMIN_EMAIL` is only used when **no** admin exists. It does not override existing admins.

## Who can do what

- **Visitors (not signed in)**: Browse catalog, read transcripts, view summaries. No Sync, Generate, Export, or queue actions.
- **Signed-in members** (`role = 'member'`): Same as visitors unless you add more permissions.
- **Admins** (`role = 'admin'`): Sync Catalog, Generate transcripts, Update audio, Manage transcription queue, Export CSV/JSON, Batch operations, Generate/Clear summaries, Generate unified summary, and access `/admin/*` routes.

Admin-only actions are hidden in the UI when the user is not an admin; the APIs also enforce `requireAdmin()` and return 401/403 if called without an admin session.
