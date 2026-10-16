-- Runs only on first initialisation of an empty data volume. Creates the database used by backend tests.
-- The backend test suite refuses to run against any database whose name does not end in "_test".
CREATE DATABASE tenderlens_test;
