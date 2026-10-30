import { describe, expect, it, vi } from "vitest";
import {
  buildPartyExtractionInput,
  extractPartySuggestions,
  parsePartyExtractionResponse,
  validatePartyExtraction,
} from "../server/ai/partyExtraction.js";

const parties = [
  { id: "party-1", party_code: "DEMO", name: "Demo Party", short_name: null },
  { id: "party-2", party_code: "OTHER", name: "Other Party", short_name: "OP" },
];

describe("Typhoon political party extraction", () => {
  const article = {
    title: "Demo Party announces a policy",
    description: "The Demo Party said the policy would be reviewed.",
    content: "",
  };

  it("builds candidate-constrained, source-only input", () => {
    const input = buildPartyExtractionInput(article, parties, {}, ["DEMO"]);
    expect(input).toContain("DEMO");
    expect(input).not.toContain("OTHER");
    expect(input).toContain("Demo Party announces a policy");
  });

  it("accepts existing party codes with traceable evidence", () => {
    const result = validatePartyExtraction({
      parties: [
        { party_code: "DEMO", relation_type: "main_subject", evidence: "Demo Party announces a policy" },
        { party_code: "UNKNOWN", relation_type: "mentioned", evidence: "Demo Party" },
      ],
    }, { article, parties });

    expect(result).toEqual([expect.objectContaining({ partyId: "party-1", relationType: "main_subject", taggingMethod: "ai" })]);
  });

  it("rejects politician-only evidence, invalid relations, and non-source evidence", () => {
    const result = validatePartyExtraction({
      parties: [
        { party_code: "DEMO", relation_type: "main_subject", evidence: "A politician said this" },
        { party_code: "DEMO", relation_type: "unsupported", evidence: "Demo Party" },
        { party_code: "DEMO", relation_type: "mentioned", evidence: "invented evidence" },
      ],
    }, { article, parties });

    expect(result).toEqual([]);
  });

  it("returns an empty result for invalid JSON", () => {
    expect(parsePartyExtractionResponse("not json")).toEqual({ parties: [] });
    expect(parsePartyExtractionResponse("```json\n{\"parties\":[]}\n```")).toEqual({ parties: [] });
  });

  it("requests structured JSON from the OpenAI-compatible Typhoon client", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ parties: [{ party_code: "DEMO", relation_type: "mentioned", evidence: "Demo Party announces a policy" }] }) } }],
    });
    const suggestions = await extractPartySuggestions({ client: { chat: { completions: { create } } }, model: "test-model", article, parties });

    expect(suggestions[0]).toMatchObject({ partyId: "party-1", taggingMethod: "ai" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ response_format: { type: "json_object" }, temperature: 0 }));
  });
});
