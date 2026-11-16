# Server-side login and admin roles: rollout

This change moves login, ticket allocation and user management to server API
routes, hashes PINs, and locks Firestore down with security rules.

## What changed

| Before | After |
| --- | --- |
| The browser checked PINs by querying every user's PIN from Firestore | `POST /api/auth/login` checks the PIN on the server and returns a Firebase sign-in token |
| PINs stored in plain text on `users` docs, readable by anyone | Salted scrypt hashes in `userSecrets`, which no browser can read |
| Generated employee IDs ended in the PIN (`user_jane_smith_hq_5678`) | They end in part of the document ID |
| Admin = `employeeId` of `ADMIN001`/`DEV007`, checked in the browser (and the logged-in user was restored from `localStorage`, so it could be faked) | Admin = `role: "admin"` on the user doc, carried in the sign-in token's `admin` claim and enforced by Firestore rules and the API |
| Hard-coded `admin123` / `dev456` PINs in the JS bundle | Removed |
| Ticket limit checked only in the browser; anyone could rewrite any prize's entries | `POST /api/allocations` checks the limit and the allocation switch in a transaction; browsers can't write prizes or allocations |
| No limit on PIN guesses | 10 wrong PINs locks the account for 5 minutes; an admin can reset the PIN (which also unlocks) |
| Admins could look up a forgotten PIN | Admins set a new one with the key button in Admin > Users |

Still done in the admin's browser (now restricted to real admins by the
rules): drawing winners, prize and tier management, settings. Moving the draw
itself to the server is the next step.

## Rollout steps (in this order)

1. **Add the service-account key to Vercel.** Firebase console > Project
   settings > Service accounts > *Generate new private key*. In Vercel >
   Project > Settings > Environment Variables, add `FIREBASE_SERVICE_ACCOUNT_KEY`
   with the JSON (or `base64 -w0 key.json`) for Production and Preview.
   Delete the downloaded file afterwards, or keep it somewhere safe.

2. **Deploy this code.** Logins keep working straight away: the first login of
   each user moves their PIN to a hash. Until step 3, nobody is an admin.

3. **Run the migration** (from a machine with the key in `.env.local`):

   ```bash
   npm run migrate:security
   ```

   This previews the changes. Check the admin list it prints, then:

   ```bash
   npm run migrate:security -- --apply
   ```

   Pass `--admins ADMIN001,DEV007` (comma-separated employee IDs) if your
   admins have different IDs. It's safe to run again.

4. **Deploy the Firestore rules** (needs `firebase login` once):

   ```bash
   npx firebase-tools deploy --only firestore:rules --project <your-project-id>
   ```

   Until this step the database is still open to direct writes, so don't
   leave a gap between steps 2 and 4.

5. **Admins log out and back in** so their token picks up the admin role.

Optional: if you don't use Firebase email/password sign-in (the old
`/firebase-login` pages are removed), disable that provider in Firebase
console > Authentication > Sign-in method.

## Notes

- Add users from the admin page (form or CSV), which hashes their PINs. A
  user added directly in the Firebase console with a plain `pin` field can
  still log in, and that login migrates the PIN.
- Removing someone's admin role takes effect the next time they log in.
- The `users` collection stays publicly readable (names, facilities, photos)
  because the winners screen shows them. It no longer holds PINs.

## Testing

`npm test` runs the rules and API tests against the Firestore and Auth
emulators (needs Java). `npm run emulators` starts the emulators for manual
testing; see `.env.example` for the variables that point the app at them.
