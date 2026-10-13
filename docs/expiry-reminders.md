# Vehicle insurance and PUC reminders

## Behaviour
Dashboard shows documents expiring in 7 days or less, including expiry-day and overdue alerts. Email is sent once per vehicle/document/recipient per India calendar day, on days 7 through 1 before expiry. No email is sent on or after expiry. Renewing a document to a date outside the window removes its alert and stops old-date reminders. Unchecking a document or archiving the vehicle also stops its reminders. Existing trips and invoices are unaffected.

## Email setup
1. Create a Resend account and verify a sender domain you own.
2. Add RESEND_API_KEY and REMINDER_EMAIL_FROM (e.g. Lucky Transport <reminders@your-domain.com>) to the server environment. Never put them in frontend variables or commit them.
3. In Settings, enter reminder recipient addresses and enable daily expiry emails.
4. Restart/redeploy the server after changing environment variables.

Email is disabled by default. Missing email configuration never prevents app startup, vehicle saves, dashboard alerts or billing. Failed email requests are recorded without provider secrets and retried after 30 minutes. Check Settings for provider acceptance/failure; provider acceptance does not guarantee inbox delivery. The free plan's message quota still applies. Each document and recipient counts as one email.

## Scheduling
The web server checks at startup and every 15 minutes while running; this does not send more than one daily reminder. To guarantee checks when the web service sleeps, configure a separate scheduled job using the same server environment and database:

npm run reminders --workspace server

Run it daily in Asia/Kolkata (for example 09:00), or hourly to allow retries. On Render this requires a separately configured Cron Job or equivalent scheduler; hosting charges depend on the service. Do not rely on a sleeping free web instance for guaranteed daily email. No hosting job has been created by this code change.

## Reliability and verification
MongoDB unique delivery IDs and atomic expiring claims prevent concurrent workers from sending the same daily reminder. Resend receives the same idempotency key on retries. Before each send, the worker checks the latest document date, archive flag, recipient list and enabled setting. API credentials are server-only; settings are Admin-only and alert reads require operations permissions. Use mocked senders in tests, never live emails. The unavoidable boundary is a renewal submitted after the provider already accepted an email: an already-sent email cannot be recalled.

Files: shared/vehicleExpiry.js (date/window rules), server/services/expiryReminderService.js (delivery/scheduling), server/routes/reminders.js (permissions/settings/alerts), server/runExpiryReminders.js (independent job), client/src/features/ExpiryAlerts.jsx and ReminderSettings.jsx (dashboard/settings).
