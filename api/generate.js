export default async function handler(req, res, options = {}) {
  setJsonHeader(res);

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Use POST /api/generate.' });
  }

  try {
    const env = options.env || process.env;
    if (!env.OPENAI_API_KEY) {
      return sendJson(res, 400, {
        error: 'OPENAI_API_KEY is missing. Add it to Vercel Environment Variables.',
      });
    }

    const body = parseBody(req.body);
    const payload = buildApiRequestPayload(body);
    const draft = await (options.createDraft || createOpenAiArticleDraft)({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5.5',
      payload,
    });
    const article = buildArticle(payload, draft);

    return sendJson(res, 200, {
      article,
      mode: 'openai_web_search',
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown generation error.',
    });
  }
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

function buildApiRequestPayload(body) {
  return {
    keyword: String(body.keyword || '').trim(),
    sourceUrls: Array.isArray(body.sourceUrls) ? body.sourceUrls.filter(Boolean) : [],
    sourceText: body.sourceText || '',
    targetLength: Number(body.targetLength || 2000),
    tone: body.tone || '친절하고 전문적인',
  };
}

async function createOpenAiArticleDraft({ apiKey, model, payload }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: buildSeoPrompt(payload),
      tools: [{ type: 'web_search_preview' }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed with status ${response.status}. ${text}`.trim());
  }

  const json = await response.json();
  return parseOpenAiJson(extractOutputText(json));
}

function buildSeoPrompt(payload) {
  const sourceUrls = payload.sourceUrls.length
    ? payload.sourceUrls.map((url) => `- ${url}`).join('\n')
    : '- 없음. 키워드 중심으로 자동 검색하세요.';

  return `
당신은 한국어 SEO 블로그 글 작성 전문가입니다.

핵심 키워드 "${payload.keyword}"에 대해 최신 웹 검색 결과를 먼저 확인한 뒤, 검색 결과에서 공통적으로 확인되는 정보와 사용자가 제공한 메모를 바탕으로 새 블로그 글 초안을 작성하세요.

목표 글자수: 약 ${payload.targetLength}자
문체: ${payload.tone}

사용자가 직접 추가한 참고 URL:
${sourceUrls}

사용자 메모:
${payload.sourceText || '없음'}

반드시 지킬 조건:
- 제목은 핵심 키워드 + 설명/혜택/문제해결 + 숫자 조합으로 만듭니다.
- 모든 제목 후보와 추천 제목은 30자 이상입니다.
- titleCandidates는 5개입니다.
- recommendedTitle은 후보 중 가장 검색 의도에 맞는 1개입니다.
- description은 200~300자입니다.
- tableOfContents는 5~6개입니다.
- sections는 tableOfContents와 대응되는 소제목/본문입니다.
- 전체 생성 콘텐츠에서 핵심 키워드는 3~4회만 자연스럽게 사용합니다.
- faq는 3개 이상입니다.
- hashtags는 5개입니다.
- 검색 결과나 원문을 그대로 복사하지 말고 새 글처럼 재구성합니다.
- 검색 결과에서 확인되지 않은 사실은 단정하지 않습니다.
- 의료, 법률, 금융 등 민감한 주제는 단정 표현을 피하고 상담/확인 필요성을 남깁니다.

응답은 아래 JSON 형식만 반환하세요. 마크다운 코드블록은 쓰지 마세요.
{
  "titleCandidates": ["제목 후보 1", "제목 후보 2", "제목 후보 3", "제목 후보 4", "제목 후보 5"],
  "recommendedTitle": "추천 제목",
  "description": "200~300자 디스크립션",
  "tableOfContents": ["목차 1", "목차 2", "목차 3", "목차 4", "목차 5"],
  "sections": [{"heading": "소제목", "body": "본문"}],
  "faq": [{"question": "질문", "answer": "답변"}],
  "hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5"]
}
`.trim();
}

function parseOpenAiJson(text) {
  return JSON.parse(
    String(text || '')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim(),
  );
}

function extractOutputText(responseJson) {
  if (responseJson?.output_text) return responseJson.output_text;

  const text = (responseJson?.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n');

  if (!text) throw new Error('OpenAI response did not include output text.');
  return text;
}

function buildArticle(payload, draft) {
  const keyword = payload.keyword || 'SEO 키워드';
  const titleCandidates = normalizeTitleCandidates(draft.titleCandidates || [], keyword);
  const recommendedTitle = ensureTitleLength(draft.recommendedTitle || titleCandidates[0], keyword);
  const description = draft.description || `${keyword} 관련 정보를 정리한 글입니다.`;
  const sections = Array.isArray(draft.sections) ? draft.sections : [];
  const faq = Array.isArray(draft.faq) ? draft.faq : [];
  const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags.slice(0, 5) : [`#${keyword.replace(/\s+/g, '')}`];

  return {
    keyword,
    titleCandidates,
    recommendedTitle,
    description,
    tableOfContents: Array.isArray(draft.tableOfContents)
      ? draft.tableOfContents.slice(0, 6)
      : sections.map((section) => section.heading).slice(0, 6),
    sections,
    faq,
    hashtags,
    sourceUrls: payload.sourceUrls,
    targetLength: payload.targetLength,
    keywordMentionCount: countKeywordMentions({ description, sections, faq }, keyword),
  };
}

function normalizeTitleCandidates(candidates, keyword) {
  const fallback = [
    `${keyword} 효과를 기대할 수 있는 5가지 이유와 선택 기준`,
    `${keyword} 선택 전 반드시 확인해야 할 5가지 핵심 기준`,
    `${keyword} 상담 전에 알아두면 좋은 7가지 체크포인트`,
    `${keyword} 고민을 줄이는 5가지 관리 방법과 주의사항`,
    `${keyword} 처음 알아볼 때 놓치기 쉬운 3가지 정보`,
  ];

  return [...new Set([...candidates, ...fallback].filter(Boolean).map((title) => ensureTitleLength(title, keyword)))].slice(0, 5);
}

function ensureTitleLength(title, keyword) {
  let result = String(title || '').includes(keyword) ? String(title || '') : `${keyword} ${title || ''}`;
  if (!/\d/.test(result)) result = `${result} 5가지 기준`;
  while (result.length < 30) {
    result = `${result} 선택 전 확인해야 할 핵심 정보`;
  }
  return result;
}

function countKeywordMentions(article, keyword) {
  const sectionsText = (article.sections || []).map((section) => `${section.heading || ''} ${section.body || ''}`).join(' ');
  const faqText = (article.faq || []).map((item) => `${item.question || ''} ${item.answer || ''}`).join(' ');
  const text = `${article.description || ''} ${sectionsText} ${faqText}`;
  return (text.match(new RegExp(escapeRegExp(keyword), 'g')) || []).length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setJsonHeader(res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json;charset=utf-8');
  }
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function') {
    return res.status(status).json(payload);
  }

  res.statusCode = status;
  return res.end(JSON.stringify(payload));
}
