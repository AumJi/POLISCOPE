-- Manual, reviewed tagging template.
-- Do not run this file unchanged. Replace every placeholder only after checking
-- the original article and confirming that the relationship is supported by the text.
-- The public API only returns rows where is_reviewed = true.

BEGIN;

INSERT INTO article_parties (
  article_id,
  party_id,
  relation_type,
  tagging_method,
  is_reviewed
)
SELECT
  a.id,
  p.id,
  'mentioned',
  'manual',
  true
FROM articles a
INNER JOIN political_parties p ON p.party_code = 'REPLACE_WITH_VERIFIED_PARTY_CODE'
WHERE a.original_url = 'REPLACE_WITH_VERIFIED_ARTICLE_URL'
ON CONFLICT (article_id, party_id) DO UPDATE SET
  relation_type = EXCLUDED.relation_type,
  tagging_method = EXCLUDED.tagging_method,
  is_reviewed = EXCLUDED.is_reviewed;

COMMIT;
