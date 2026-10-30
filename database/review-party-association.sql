-- Safe manual review workflow for an automatically suggested association.
-- Replace both placeholders only after checking the original article.
-- This updates an existing pending suggestion; it does not create a new row.

BEGIN;

UPDATE article_parties ap
SET is_reviewed = true,
    tagging_method = 'manual'
FROM articles a
INNER JOIN political_parties p ON p.id = ap.party_id
WHERE ap.article_id = a.id
  AND p.party_code = 'REPLACE_WITH_VERIFIED_PARTY_CODE'
  AND a.original_url = 'REPLACE_WITH_VERIFIED_ARTICLE_URL'
  AND ap.is_reviewed = false;

COMMIT;

-- Review pending suggestions before approval:
-- SELECT a.title, a.original_url, p.party_code, p.name,
--        ap.relation_type, ap.tagging_method, ap.created_at
-- FROM article_parties ap
-- INNER JOIN articles a ON a.id = ap.article_id
-- INNER JOIN political_parties p ON p.id = ap.party_id
-- WHERE ap.is_reviewed = false
-- ORDER BY ap.created_at DESC;
