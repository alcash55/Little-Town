-- Issue #51: the initial-schema migration seeded fixture 'admin'/'user'
-- rows straight into the production `users` table. Since `username` is
-- UNIQUE, those two rows permanently reserved the usernames "admin" and
-- "user" and blocked real signup under either name.
--
-- Deletes only rows that still look exactly like the original fixture
-- insert (dev-only password_hash sentinel + the fixture email) so this is
-- a no-op everywhere the rows have already been changed or don't exist,
-- and never touches a real account that happens to be named "admin" after
-- re-registering the name once this migration frees it up.
DELETE FROM users
WHERE username IN ('admin', 'user')
  AND email IN ('admin@littletown.local', 'user@littletown.local')
  AND password_hash = 'dev:password';
