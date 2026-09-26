# Loopader — GO-LIVE CHECKLIST

## Pre-launch (required)
- [ ] Replace all sandbox credentials:
  - [ ] JazzCash: `JAZZCASH_MERCHANT_ID/PASSWORD/INTEGRITY_SALT` → **live** values
  - [ ] EasyPaisa: merchant ID/username/password/hash → **live** values
  - [ ] Stripe: `STRIPE_SECRET_KEY` → **live** key (remove `sk_test_`)
  - [ ] NOWPayments: live API key + IPN secret
- [ ] Set `ADMIN` role on your account: `UPDATE "User" SET role='ADMIN' WHERE email='you@domain.com';`
- [ ] Set `RESEND_FROM` to a verified sending domain.
- [ ] Enable Cloudflare proxy (orange cloud) on the apex + subdomains.
- [ ] Set `NEXT_PUBLIC_APP_URL` to `https://loopader.com` (no trailing slash).
- [ ] Generate long random `NEXTAUTH_SECRET`, `JWT_ACCESS_SECRET`, `ENCRYPTION_KEY`; store them in a password manager.
- [ ] Set `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` to the live domain.
- [ ] Configure Vercel Cron (`vercel.json`) and set `CRON_SECRET`.

## Database
- [ ] Run `npx prisma migrate deploy` (or `db push`) against Neon.
- [ ] Run `npx prisma db seed`.
- [ ] Verify seed: `SELECT count(*) FROM "User";` shows admin + 5 demo users.

## Smoke test round-trip
- [ ] Register a brand-new user (Turnstile + HIBP checks pass) — with `?ref=<userId>` in the URL → `Referral` row created.
- [ ] Email verification code received → after verify, welcome email arrives.
- [ ] Onboarding: 6 steps → guided first demo trade → confetti + FIRST_TRADE badge → dashboard coach marks appear once.
- [ ] Demo account → $10,000 balance shown; open a demo trade (BUY 0.01 EURUSD) → position appears.
- [ ] Set SL/TP → modify trade → close trade → P&L settles + trade notification + push.
- [ ] KYC: upload ID front/back + selfie at `/kyc` (≤2MB each) → admin queue → approve → status VERIFIED + email; reject path sends reason email.
- [ ] Unverified deposit limit: try a $600 deposit on an unverified account → 403 on stripe/crypto/bank routes; ≤$500 passes.
- [ ] JazzCash deposit (live) → webhook credits live account instantly + deposit email + notification.
- [ ] Stripe test card `4242 4242 4242 4242` deposit → webhook confirms + credits live account (idempotent).
- [ ] Referral: referee's confirmed deposits reach $50 → referrer's live balance +$10, referral status PAID.
- [ ] Withdraw small amount → 2FA + email confirm → admin approves → PAID + processed email; reject path sends rejection email.
- [ ] Price alert: set EURUSD ABOVE alert at current price ± → triggers within ~5s → notification + push.
- [ ] Admin panel `/admin`: stats load, deposits/withdrawals queues act, user search + freeze (reason required) + balance adjust (reason → SecurityEvent), leaders feature/unfeature persists, Audit Log tab shows events.
- [ ] Notification bell shows unread badge; `/notifications` page lists items; "mark all read" works.
- [ ] Socket worker: `/` on Render URL returns `{"status":"ok"}`.
- [ ] Landing `/` loads, live ticker animates, 3D hero renders on desktop.
- [ ] Coach chat responds (Groq key active).
- [ ] Mobile (Expo Go / dev build): login → push permission prompt → token registered; Home shows offline banner when API unreachable; Social + Coach tabs work.

## Security checks
- [ ] 5 failed logins from one IP → rate limited.
- [ ] Login from a new device → new-device email + security notification.
- [ ] Login from a different country → risk alert / forced re-auth.
- [ ] Passkey registration works over HTTPS (required for WebAuthn).
- [ ] Large withdrawal (>$1000) goes to `ADMIN_REVIEW`.
- [ ] `SecurityEvent` rows created for login/trade/withdraw/admin actions; visible in Admin → Audit Log.

## Legal / content
- [ ] Risk disclaimer footer present on all pages.
- [ ] Terms + Privacy pages reachable.
- [ ] Support email set on landing page contact.
