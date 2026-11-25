# Delivery and payment tracking

The order detail page follows **Request received → Processing → Shipped → Out for delivery → Delivered**. Choosing a different status saves it immediately. The dropdown enables only the current status, the next stage and cancellation before shipping. Shipped and Out for delivery orders cannot be cancelled. Delivered and cancelled orders have no further delivery transitions. Historical Confirmed orders can move to Processing; historical Completed orders remain readable without rewriting their saved status or prices.

Payment is tracked independently as **Unpaid** or **Paid** and saves immediately when selected. Only a verified administrator can record it. Delivery never marks an order paid automatically. Existing orders initially have Unpaid as the recorded payment status and should be reviewed before marking them Paid. Both controls reject stale edits, and payment changes also check a version timestamp so an older edit cannot overwrite a payment status that changed twice.

## Deployment

1. Apply [order-fulfilment-setup.sql](../supabase/order-fulfilment-setup.sql) in the hosted Supabase SQL Editor after the existing order/admin setup and before deploying the website. The upgrade is transactional and safe to rerun. It adds the payment fields and protected payment RPC, extends delivery transitions and updates the optional email-history constraint. It preserves saved order totals, delivery snapshots and historical statuses.
2. Deploy the updated website. The upgrade keeps the old Confirmed/Completed RPC transitions working during the deployment; the updated interface uses the delivery stages above.
3. Keep the existing server-only Firebase and Supabase configuration described in [push notifications](push-notifications.md). No new push credentials or webhook are required.

## Orders dashboard

`/admin/orders` shows Total orders, Pending orders, Order value and Unpaid value. Metrics and status-tab counts cover all matching orders, not only the current page. They follow the search, date, payment-status and payment-mode filters across all statuses. Switching a status tab changes the list while keeping that overview scope. Both value metrics exclude cancelled orders; Order value includes paid and unpaid requests and is not a collected-revenue figure. Historical requests without a delivery total use their saved item total.

Metrics use a compact strip. Search and the Active status selector remain visible; the Filters button expands date, payment and sorting controls and quick date ranges. Its badge counts applied advanced filters. Closing the panel keeps those values in form submissions. Invalid date ranges expand the panel for correction.

The three tabs are Pending, Active and Cancelled. Pending is the default and contains newly received requests. Active groups Confirmed, Processing, Shipped, Out for delivery, Delivered and historical Completed orders; its Active status dropdown narrows the list to one stage. Clearing filters keeps the selected tab. Existing links to a specific status still open the matching tab and stage. Search accepts a customer name, phone number, full order ID or the short reference with an optional `#`. Date ranges use inclusive calendar dates in IST, with Today, Last 7 days, Last 30 days and All time shortcuts. Payment mode includes COD, historical Manual UPI and requests with no mode recorded. Sorting supports newest, oldest, highest total and lowest total. Tabs and pagination preserve the other filters; applying filters resets pagination. Out-of-range pages clamp to the final available page.

The same [order fulfilment upgrade](../supabase/order-fulfilment-setup.sql) installs the protected dashboard RPC. Reapply the latest version before deploying the dashboard if an earlier copy has already been installed. The RPC checks current admin membership and returns one consistent snapshot for metrics, counts and paginated rows.

## Customer notifications

A successful delivery-status change in the admin order page automatically requests a push notification for that order's actual customer. The admin does not need to tick a separate notification checkbox. Payment-status edits do **not** send push notifications.

Notifications open the customer's account/order history. Only that customer's registered devices are targeted. A status change must save successfully before notification delivery is attempted. The notification helper skips an update superseded by a newer stage, and the existing event key and sending history prevent duplicate delivery attempts for the same order and stage. A provider failure does not roll back a saved status; the admin sees the notification result and can inspect `/admin/notifications`. Customers without registered devices remain eligible for order tracking, with no push sent.

The existing email webhook also supports the new delivery stages when email is configured. Payment changes do not trigger the status-based email webhook.

Local PostgreSQL, notification and browser tests use fixture data and injected senders. No real customer notifications or live order/payment changes are made by those tests.
