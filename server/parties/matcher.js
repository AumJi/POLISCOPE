// Party names and short names stored in political_parties are treated as the
// verified vocabulary. Add externally verified aliases here by party_code only.
export const VERIFIED_PARTY_ALIASES = Object.freeze({});

export function normalizePartyMatchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("th-TH")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPartyTerms(party, aliasesByCode = VERIFIED_PARTY_ALIASES) {
  const aliases = aliasesByCode[party.party_code] || aliasesByCode[party.code] || [];
  return [...new Set([
    party.name,
    party.short_name,
    ...(Array.isArray(aliases) ? aliases : []),
  ].map(normalizePartyMatchText).filter((term) => term.length >= 2))];
}

export function findPartyMatches(article, parties, aliasesByCode = VERIFIED_PARTY_ALIASES) {
  const text = normalizePartyMatchText([article?.title, article?.description].filter(Boolean).join(" "));
  if (!text) return [];

  return parties
    .filter((party) => getPartyTerms(party, aliasesByCode).some((term) => text.includes(term)))
    .map((party) => ({
      partyId: party.id,
      partyCode: party.party_code || party.code,
      relationType: "mentioned",
      taggingMethod: "name_match",
    }));
}

export function buildPartyAssociationQuery({ articleId, partyId, relationType = "mentioned", taggingMethod = "name_match" }) {
  return {
    text: `
      INSERT INTO article_parties (
        article_id, party_id, relation_type, tagging_method, is_reviewed
      )
      VALUES ($1, $2, $3, $4, false)
      ON CONFLICT (article_id, party_id) DO NOTHING
      RETURNING article_id
    `,
    values: [articleId, partyId, relationType, taggingMethod],
  };
}
