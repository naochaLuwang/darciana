# Whole-rupee pricing

Every INR amount is displayed without decimal digits using the shared `money()` formatter. Values round to the nearest rupee: ₹499.49 becomes ₹499 and ₹499.50 becomes ₹500. Indian digit grouping is retained.

Each discounted unit selling price is rounded before quantity multiplication. Delivery fees are rounded separately, then added to the item subtotal. For example, a ₹999 item with a 50% discount costs ₹500 each; three units plus ₹51 delivery total ₹1,551. This keeps displayed line amounts and the amount requested at checkout consistent.

Admin product prices, variant prices, delivery charges and flat rupee discounts use whole-number fields. Pasted fractional rupee values round when the field loses focus; server validation also requires whole numbers. Percentage discounts remain percentage rates and may include fractions such as 12.5%.

## Hosted database upgrade

Run `supabase/whole-rupee-setup.sql` in the Supabase SQL Editor after the existing store/checkout setup. The script is transactional and can be rerun. It:

- Rounds current product/variant base prices, flat discounts and delivery fees.
- Installs triggers to normalize future monetary writes.
- Updates database checkout pricing to round each selling price and delivery charge identically to the app.
- Preserves existing order snapshots, auth accounts, profiles and categories.

Apply the SQL before deploying the updated website/APK so percentage discounts use the same rules in both places. Local pre-upgrade catalog/delivery values were backed up under the ignored `artifacts/whole-rupees/` directory. Existing saved order amounts are formatted as whole rupees but their historical stored values are not rewritten.
