# Breakfast Menu API

Express and MongoDB API for the breakfast menu.

## Local setup

1. Copy `.env.example` to `.env` and replace the three MongoDB URIs with the connection strings for the users, ingredients, and recipes clusters. Keep credentials private and URL-encode special characters in passwords.
2. Set a private `JWT_SECRET` and the admin/user seed values. Use passwords with at least 12 characters.
3. Run `npm install`, then `npm run dev`.
4. In another terminal, run `npm run seed:admin` and `npm run seed:user` once each.

`UI_ORIGIN` is required and must exactly match the browser origin allowed to call the API. For Vercel, set it to `https://breakfast-menu-ui.vercel.app` in the API project's environment variables and redeploy.

The API waits for all three connections before listening. `Ingredient.quantityOnHand` is the canonical pantry inventory. `BreakfastRequest` and ingredient deductions share a transaction on the ingredients cluster. `DailyStock` is a derived per-date recipe-availability projection stored in the recipes cluster's `daily-stock` collection; it is refreshed after orders and on menu/availability reads. Cross-cluster references are resolved by API queries, not automatic Mongoose population.

## Admin catalog routes

All catalog routes require a JWT for a user with the `admin` role. Ingredient and recipe deletion is a soft deactivation so existing references and request history are retained.

- `GET /api/admin/ingredients?includeInactive=true`
- `POST /api/admin/ingredients`
- `PUT /api/admin/ingredients/:id`
- `DELETE /api/admin/ingredients/:id`
- `GET /api/admin/recipes?includeInactive=true`
- `GET /api/admin/recipes/:id`
- `POST /api/admin/recipes`
- `PUT /api/admin/recipes/:id`
- `DELETE /api/admin/recipes/:id`
- `GET /api/admin/notifications?page=1` returns order notifications newest-first, 10 per page.

Successful order placements create a notification in the users cluster's `notifications` collection, including the customer, order snapshot, and order time.

## Daily stock

- `GET /api/admin/daily-stock` recalculates and returns each recipe's availability for the configured service date. Use `?date=YYYY-MM-DD` to view another date.

The admin page is `/admin/daily-stock` and is a read-only availability report. Set pantry quantities and base units from `/admin/ingredients`. A recipe is available when every required ingredient has enough on hand.

## User menu and requests

- `GET /api/menu/today` returns active recipes that fit today's remaining ingredient stock, plus the signed-in user's current request.
- `POST /api/requests` creates or changes the signed-in user's breakfast request and deducts required ingredients.
- `DELETE /api/requests/today` cancels today's request and restores its ingredient quantities.

Menu and request routes require a JWT. Ingredient deductions/restores and request writes run in a transaction on the ingredients cluster; the DailyStock projection refreshes after that transaction and is rebuilt on subsequent reads if needed. The API also exposes `GET /api/health` and `POST /api/auth/login`.