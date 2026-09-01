-- The specific type a public listing already carries and our own 8-category
-- taxonomy collapses away: "mexican_restaurant" becomes just "eat_drink".
-- Kept as free text, shown as a descriptive label, never spoken as a fact
-- the way a phone number is — so it needs no confirmation gate.
alter table places add column public_subcategory text;
