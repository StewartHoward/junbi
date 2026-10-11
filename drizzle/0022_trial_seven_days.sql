-- Trials are now 7 days. Clubs that signed up on the old longer trial get 7 days from today, no more.
UPDATE "clubs" SET "trial_ends_on" = CURRENT_DATE + 7 WHERE "trial_ends_on" > CURRENT_DATE + 7;
