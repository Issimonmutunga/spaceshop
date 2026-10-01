"use client";

import type { ID } from "./types";

/**
 * AI touchpoints. Real implementations land later; every call site is wired
 * to these signatures today, so nothing has to move when a model arrives.
 *
 * UI rule: AI output only prefills. The user confirms with one tap.
 */

export interface ExtractedItem {
  name: string;
  brand?: string;
  category?: string;
  size?: string;
  tags: string[];
  confidence: number; // 0..1
}

export interface Extractor {
  extractItem(image: Blob): Promise<ExtractedItem>;
  suggestPlace(item: ExtractedItem, spaceId: ID): Promise<ID[]>;
  answerQuery(text: string): Promise<{ itemIds: ID[] }>;
}

const MOCK_NAMES = [
  "Boxed cereal",
  "Bottled water",
  "Tinned beans",
  "Bar soap",
  "Coffee jar",
  "Paper towels",
  "Cheese block",
  "Dish tablets",
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stubbed extraction: deterministic on the image bytes so demos are stable. */
export const mockExtractor: Extractor = {
  async extractItem(_image: Blob) {
    await delay(600);
    const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
    return {
      name,
      category: "unknown",
      tags: [],
      confidence: 0.42,
    };
  },

  async suggestPlace(_item: ExtractedItem, _spaceId: ID) {
    await delay(250);
    return [];
  },

  async answerQuery(_text: string) {
    await delay(300);
    return { itemIds: [] };
  },
};

/** Swapped for a `/api/extract` proxy when a provider key exists server-side. */
export const ai: Extractor = mockExtractor;
