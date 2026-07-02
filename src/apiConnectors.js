export function buildApiRequestPayload({
  keyword,
  sourceUrls = [],
  sourceText = '',
  targetLength = 2000,
  tone = '친절하고 전문적인',
} = {}) {
  return {
    keyword: String(keyword || '').trim(),
    sourceUrls: sourceUrls.filter(Boolean),
    sourceText,
    targetLength,
    tone,
    requiredStructure: {
      titlePattern: 'keyword + explanation + number',
      descriptionLength: '200-300 Korean characters',
      tableOfContents: '5-6 items',
      bodyLength: 'about 2000 Korean characters',
      keywordMentions: '3-4 times in generated content',
      faq: '3 or more Q&A items',
      hashtags: 5,
    },
  };
}

export async function requestArticleDraft({ endpoint, payload, fetcher = fetch }) {
  if (!endpoint) {
    throw new Error('API endpoint is required.');
  }

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || `API request failed with status ${response.status}.`);
  }

  return json;
}

export function mergeApiDraft({ keyword, draft }) {
  return {
    keyword,
    description: draft?.description || '',
    sections: Array.isArray(draft?.sections) ? draft.sections : [],
    faq: Array.isArray(draft?.faq) ? draft.faq : undefined,
    hashtags: Array.isArray(draft?.hashtags) ? draft.hashtags : undefined,
  };
}
