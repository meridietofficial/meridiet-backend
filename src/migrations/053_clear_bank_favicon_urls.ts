// Google favicon service only returns 16x16 icons — not usable as bank logos.
// The API now falls back to ui-avatars.com (initials-based) when logo_url is NULL.
// Clear the broken favicon URLs so the fallback kicks in for all banks.

export const up = `
  UPDATE banks SET logo_url = NULL WHERE logo_url LIKE '%google.com/s2/favicons%';
`;

export const down = `
  -- Cannot restore the removed URLs without re-running migration 052
`;
