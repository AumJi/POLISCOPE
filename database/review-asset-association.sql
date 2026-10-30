-- Manual review workflow for MARKETSCOPE asset suggestions.
-- Verify the article text and asset relationship before running.

UPDATE article_assets aa
SET is_reviewed = true
FROM articles a, market_assets ma
WHERE aa.article_id = a.id
  AND aa.asset_id = ma.id
  AND a.original_url = 'REPLACE_WITH_VERIFIED_ARTICLE_URL'
  AND ma.symbol = 'REPLACE_WITH_VERIFIED_ASSET_SYMBOL'
  AND aa.is_reviewed = false;

-- To reject an incorrect suggestion without deleting the article:
-- DELETE FROM article_assets
-- WHERE article_id = (SELECT id FROM articles WHERE original_url = '...')
--   AND asset_id = (SELECT id FROM market_assets WHERE symbol = '...')
--   AND is_reviewed = false;
