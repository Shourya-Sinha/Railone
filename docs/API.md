# RailwayOne Pro — REST API (demo)

> **DEMO ONLY.** Every station, train, PNR, running-status, fare and ticket served by this API is sample or simulated data.
> The API doesn't connect to Indian Railways, CRIS, IRCTC, RailOne or any payment gateway, and it can't issue real tickets.

- Base URL: `http://localhost:4000/api` (in dev, the Vite server on `:5173` proxies `/api` to it)
- Format: JSON request and response bodies. Money is always **integer paise** (`totalPaise: 1500` = ₹15.00).
- Dates are `YYYY-MM-DD` and are evaluated in **IST (Asia/Kolkata)**.
- Every response carries `X-Request-Id` and `X-Demo-Notice` headers.

## Conventions

### Authentication
Sessions use an **httpOnly cookie** named `rw1_session`. You get it from `POST /auth/login` or `POST /auth/register`.
The server stores only an HMAC of the session token. Sessions expire after `SESSION_TTL_HOURS`.

### CSRF protection
Every non-GET request must send the header **`X-RW1-Client: web`** (any non-empty value works).
A cross-site form can't set custom headers, and CORS limits which origins may read responses.

### Errors
All errors share one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Enter a valid email address",
             "details": { "fields": [{ "field": "email", "message": "Enter a valid email address" }] },
             "requestId": "1b86cd23-…" } }
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (with `details.fields`), `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED` |
| 402 | `PAYMENT_FAILED`, `INSUFFICIENT_BALANCE` (simulated declines; `details.txnRef` is included) |
| 403 | `FORBIDDEN` (wrong role, or missing `X-RW1-Client`) |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, `BOOKING_NOT_PAYABLE`, `BOOKING_NOT_CANCELLABLE` |
| 422 | `INVALID_JOURNEY` (e.g. same source and destination, or a date outside the allowed window) |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` (logged to `ErrorLog`; the message is generic) |

### Pagination
List endpoints accept `page` (default 1) and `pageSize` (default 20, max 100). They return:
`meta: { page, pageSize, total, totalPages }`.

### Rate limits (per IP, configurable)
| Scope | Default |
|---|---|
| All `/api` | `RATE_LIMIT_MAX` = 600 per 15 min |
| `/auth/login`, `/auth/register`, `/client-errors` | `AUTH_RATE_LIMIT_MAX` = 30 per 15 min |
| `/bookings/:id/pay`, `/wallet/topup` | `PAYMENT_RATE_LIMIT_MAX` = 60 per 10 min |

Responses carry IETF `RateLimit` / `RateLimit-Policy` headers.

---

## System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | `{ status: "ok", service, demo: true, time }` |
| POST | `/client-errors` | – | Body `{ message, stack?, path? }`. Stores a front-end error, which admins can view. |

## Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, phone?, password }`. The password needs 8+ characters with a letter and a number; the phone is a 10-digit Indian mobile number. | `201 { user }` and sets the cookie |
| POST | `/auth/login` | `{ email, password }` | `{ user }` and sets the cookie. Wrong credentials return `401`. |
| POST | `/auth/logout` | – | `{ ok: true }` and clears the cookie |
| GET | `/auth/me` | – | `{ user, unreadNotifications }` |

`user` = `{ id, email, name, phone, role: "USER"|"ADMIN", walletBalancePaise, preferences, createdAt }`

## Stations (public)
The dataset comes from `server/data/stations.sample.json` and is seeded into the `Station` table.

| Method | Path | Description |
|---|---|---|
| GET | `/stations?q=pat&limit=10` | Autocomplete by code (exact code, then prefix), name or city. Returns `{ results: Station[] }`. |
| GET | `/stations/popular` | `{ results }` |
| GET | `/stations/:code` | `{ station }`, or `404` for unknown codes |

`Station` = `{ code, name, city, state, zone, isPopular }`

## Fares
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/fares/table` | – | `{ fareTable }`: the full **DEMO-FARE-2026.1** slab table, surcharges, rules and disclaimer |
| POST | `/fares/quote` | ✓ | Unreserved: `{ type:"UNRESERVED", from, to, journeyDate, trainType, adults, children }`. Platform: `{ type:"PLATFORM", station, persons }`. Returns `{ quote }`. |

`quote` = `{ fareTableVersion, disclaimer, distanceKm?, trainType?, classCode, baseAdultRupees?, surchargeRupees?, perAdultPaise, perChildPaise, adults, children, lines[{label,quantity,unitPaise,amountPaise}], totalPaise }`

Rules (enforced on the server; the client only mirrors them):
- Adult fare = max(₹10, ceil5(slab base + surcharge)). Surcharges: Ordinary ₹0, Express ₹15, Superfast ₹30.
- Child fare = ceil5(base × 0.5) + surcharge.
- 1–4 passengers per ticket, with at least one adult. Unreserved journeys are for today or tomorrow (IST) only.
- Platform tickets cost ₹10 per person (max 4), are valid for 2 hours, and can't be cancelled.
- Distance is a demo approximation: great-circle distance × 1.22.

## Mock journey data (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/trains/search?from=PNBE&to=HWH&date=2026-10-22&mode=unreserved\|reserved` | `{ mock:true, notice, from, to, date, distanceKm, via[], trains[] }`. Trains are generated deterministically for each route. Reserved mode adds `classes[{code,label,fareRupees,availability}]`. |
| GET | `/trains/:number/running-status?from=&to=` | `{ status, notice }`: simulated live position (5-digit train number) |
| GET | `/pnr/samples` | `{ samples: string[] }` |
| GET | `/pnr/:pnr` | `{ status, notice }`: simulated PNR status. Sample PNRs: `2451837690`, `4120985563`, `8347201196`. PNRs starting with 0 or 9 return `404`. |

## Bookings (auth required, scoped to the current user)
| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/bookings/unreserved` | `{ from, to, journeyDate, trainType, trainNumber?, adults, children }` | `201 { booking }` with status `PENDING_PAYMENT` (15-minute hold) |
| POST | `/bookings/platform` | `{ station, persons }` | `201 { booking }` |
| GET | `/bookings?scope=all\|active\|past&status=&type=&page=&pageSize=` | – | `{ bookings, meta }` |
| GET | `/bookings/:id` | – | `{ booking }` |
| POST | `/bookings/:id/pay` | A payment object (see below) | `{ booking, txnRef }`. A declined payment returns `402`. |
| POST | `/bookings/:id/cancel` | – | `{ booking, refundPaise }` |
| GET | `/bookings/:id/receipt.pdf` | – | A PDF receipt watermarked **DEMO ONLY — NOT VALID FOR TRAVEL** |

`booking` includes `{ id, bookingRef ("DEMO-UTS-XXXXXXXX" / "DEMO-PF-XXXXXXXX"), type, status, source, destination, journeyDate, trainType, trainNumber, adults, children, passengers, distanceKm, fare, totalPaise, paymentMethod, qrPayload, holdExpiresAt, validFrom, validUntil, paidAt, cancelledAt, refundPaise, createdAt, cancellable, demoWarning }`.

Status lifecycle: `PENDING_PAYMENT` → `CONFIRMED` → `CANCELLED`. An unpaid hold becomes `EXPIRED` after 15 minutes.
Cancellation is allowed only for confirmed **unreserved** tickets that are still valid. The refund is the total minus ₹15 demo clerkage per passenger, credited to the demo wallet.

The `qrPayload` begins with `RAILWAYONE-PRO-DEMO|DEMO ONLY — NOT VALID FOR TRAVEL|…` and carries a demo HMAC tag. It is **not** a travel credential.

### Simulated payment object
```jsonc
{ "method": "WALLET" }
{ "method": "DEMO_UPI",  "upiId": "success@demoupi" }      // IDs starting with "fail" are declined; must end in @demoupi
{ "method": "DEMO_CARD", "cardNumber": "4111111111111111", "expiry": "12/30", "cvv": "123" }
```

Test cards: `4111 1111 1111 1111` and `5555 5555 5555 4444` succeed, and `4000 0000 0000 0002` is declined.
The server checks the Luhn digit, expiry (MM/YY, not in the past) and a 3-digit CVV. Only the last 4 digits are stored, and the CVV is never stored.
A malformed instrument (bad Luhn digit, expired card, non-`@demoupi` UPI ID) returns `400 VALIDATION_ERROR` with `fields[0].field = "payment"`. A simulated decline returns `402 PAYMENT_FAILED`, and a `FAILED` transaction is recorded.

## Wallet, profile, notifications, support (auth required)
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/wallet?type=&page=&pageSize=` | – | `{ balancePaise, transactions[], meta }` |
| POST | `/wallet/topup` | `{ amountRupees (100–10000), payment }` (`WALLET` not allowed; max balance ₹20,000) | `{ balancePaise, txnRef }` |
| PATCH | `/me` | `{ name?, phone?\|null, preferences?{language,notifyBookings,notifyOffers,defaultTrainType,paperlessTicket} }` | `{ user }` |
| POST | `/me/password` | `{ currentPassword, newPassword }` | `{ ok }`; revokes your other sessions |
| GET | `/notifications?page=&pageSize=` | – | `{ notifications, unread, meta }` |
| POST | `/notifications/:id/read` | – | `{ ok }` |
| POST | `/notifications/read-all` | – | `{ ok }` |
| GET | `/support/requests` | – | `{ requests }` |
| POST | `/support/requests` | `{ category: BOOKING\|PAYMENT\|REFUND\|ACCOUNT\|FEEDBACK\|OTHER, subject, message }` | `201 { request }` |

## Admin (role `ADMIN`; other users get `403`)
| Method | Path | Filters | Notes |
|---|---|---|---|
| GET | `/admin/stats` | – | User, booking, revenue and transaction aggregates; 14-day daily series; top routes; error count for the last 24h |
| GET | `/admin/users` | `q, role, disabled, page, pageSize` | |
| PATCH | `/admin/users/:id` | Body `{ disabled }` | Revokes the user's sessions; you can't disable yourself |
| GET | `/admin/bookings` | `q` (ref, email or station code), `status, type` | |
| GET | `/admin/transactions` | `q, type, status, method` | |
| GET | `/admin/stations` | `q, zone, active, popular` | Also returns `zones[]` |
| POST | `/admin/stations` | Body `{ code, name, city, state, zone, lat, lng, isPopular?, isActive? }` | Invalidates the station cache |
| PATCH | `/admin/stations/:id` | Any field except `code` | |
| GET | `/admin/health` | – | Database latency, uptime, memory, load, migrations, station cache, pending holds |
| GET | `/admin/errors` | `q, level (error\|warn), source (server\|web)` | |
| GET | `/admin/audit` | `q, action` | Audit trail of logins, bookings, payments, cancellations and admin actions |

## Quick curl session
```bash
H='-H Content-Type:application/json -H X-RW1-Client:web'
curl -c jar -s $H -X POST localhost:4000/api/auth/login -d '{"email":"demo@railwayone.dev","password":"Demo@12345"}'
B=$(curl -b jar -s $H -X POST localhost:4000/api/bookings/platform -d '{"station":"PNBE","persons":1}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).booking.id')
curl -b jar -s $H -X POST localhost:4000/api/bookings/$B/pay -d '{"method":"DEMO_UPI","upiId":"success@demoupi"}'
```
