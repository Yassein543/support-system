# Backend services

Reusable server and bot modules live here. `app.js` and `bot.js` remain in the project root because they are the Vercel and bot process entry points.

- `guild-settings.js` — server configuration, embeds, and backup task storage.
- `subscription-service.js` and `subscription-plans.js` — plan state and plan access rules.
- `ip-ban-service.js` — abuse tracking and server-side user statistics.
- `support-service.js` and `2fa-service.js` — support verification and two-factor authentication.
- `user-preferences.js` — user language and profile-card preferences.

Static pages and assets stay in the root because the app and Vercel routes serve their current public paths directly.
