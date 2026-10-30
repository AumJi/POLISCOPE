import { describe, expect, it, vi } from "vitest";
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryInput,
  hashSummaryInput,
  isUuid,
  streamSummary,
} from "../server/ai/summarize.js";

async function* fakeStream() {
  yield { choices: [{ delta: { content: "สรุปข่าว\n" } }] };
  yield { choices: [{ delta: { content: "ข้อมูลสำคัญ" } }] };
}

describe("Typhoon financial summary helpers", () => {
  it("creates deterministic SHA-256 input hashes", () => {
    const input = buildSummaryInput({ title: "ข่าว", description: "ข้อมูล" });
    expect(hashSummaryInput(input)).toHaveLength(64);
    expect(hashSummaryInput(input)).toBe(hashSummaryInput(input));
    expect(hashSummaryInput(input)).not.toBe(hashSummaryInput(`${input}!`));
  });

  it("marks missing content as an excerpt and bounds input length", () => {
    const input = buildSummaryInput({ title: "หัวข้อ", description: "คำอธิบาย" });
    expect(input).toContain("มีเฉพาะคำอธิบายหรือบทคัดย่อ");
    expect(buildSummaryInput({ title: "หัวข้อ", content: "x".repeat(20_000) }).length).toBeLessThan(12_200);
  });

  it("contains neutral financial summary guidance", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain("สรุปข่าว");
    expect(SUMMARY_SYSTEM_PROMPT).toContain("ประเด็นสำคัญ");
    expect(SUMMARY_SYSTEM_PROMPT).toContain("สิ่งที่ยังไม่ชัดเจน");
    expect(SUMMARY_SYSTEM_PROMPT).toContain("ห้ามสร้างราคา");
    expect(SUMMARY_SYSTEM_PROMPT).toContain("ห้ามให้คำแนะนำซื้อ");
  });

  it("validates UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("collects streamed deltas and returns only a completed summary", async () => {
    const onDelta = vi.fn();
    const client = { chat: { completions: { create: vi.fn().mockResolvedValue(fakeStream()) } } };
    const summary = await streamSummary({ article: { title: "ข่าว", content: "ข้อมูล" }, client, onDelta, model: "test-model" });
    expect(summary).toBe("สรุปข่าว\nข้อมูลสำคัญ");
    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(client.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({ stream: true, temperature: 0.1 }));
  });
});
