/**
 * Migration: 003 — Drop old user_profiles table
 * The table was renamed to diet_forms in migration 002.
 * This cleans up the leftover user_profiles table from the previous run.
 */

export const up = `
  DROP TABLE IF EXISTS user_profiles;
`;

export const down = `
  -- No-op: user_profiles was a temporary table during development
  SELECT 1;
`;
