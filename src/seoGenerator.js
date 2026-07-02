const MIN_TITLE_LENGTH = 30;

const DEFAULT_TOPICS = [
  '핵심 효과를 확인해야 하는 이유',
  '방문 전 살펴볼 기준',
  '상담 과정에서 확인할 내용',
  '회복과 관리를 함께 보는 방법',
  '주의해야 할 점과 선택 기준',
];

const TITLE_PATTERNS = [
  (keyword) => `${keyword} 효과를 기대할 수 있는 5가지 이유와 선택 기준`,
  (keyword) => `${keyword} 선택 전 반드시 확인해야 할 5가지 핵심 기준`,
  (keyword) => `${keyword} 상담 전에 알아두면 좋은 7가지 체크포인트`,
  (keyword) => `${keyword} 고민을 줄이는 5가지 관리 방법과 주의사항`,
  (keyword) => `${keyword} 처음 알아볼 때 놓치기 쉬운 3가지 정보`,
];

export function generateSeoArticle({
  keyword,
  sourceText = '',
  sourceUrls = [],
  targetLength = 2000,
  tone = '친절하고 전문적인',
  apiDraft = null,
} = {}) {
  const cleanKeyword = normalizeKeyword(keyword);
  const insights = extractInsights(sourceText, cleanKeyword);
  const titleCandidates = normalizeTitleCandidates(
    apiDraft?.titleCandidates || TITLE_PATTERNS.map((pattern) => pattern(cleanKeyword)),
    cleanKeyword,
  );
  const recommendedTitle = ensureTitleLength(apiDraft?.recommendedTitle || titleCandidates[0], cleanKeyword);
  const tableOfContents = apiDraft?.tableOfContents?.slice(0, 6) || buildTableOfContents(cleanKeyword, insights);
  const description = apiDraft?.description || buildDescription(cleanKeyword, insights, tone);
  const sections = apiDraft?.sections || buildSections(cleanKeyword, tableOfContents, insights, targetLength, sourceUrls);
  const faq = apiDraft?.faq || buildFaq(cleanKeyword, insights);
  const hashtags = apiDraft?.hashtags || buildHashtags(cleanKeyword, insights);

  return {
    keyword: cleanKeyword,
    titleCandidates,
    recommendedTitle,
    description,
    tableOfContents,
    sections,
    faq,
    hashtags,
    sourceUrls: sourceUrls.filter(Boolean),
    targetLength,
    keywordMentionCount: countKeywordMentions({ description, sections, faq }, cleanKeyword),
  };
}

export function articleToMarkdown(article) {
  const titleCandidates = article.titleCandidates
    .map((title, index) => `${index + 1}. ${title}`)
    .join('\n');
  const toc = article.tableOfContents
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
  const body = article.sections
    .map((section) => `## ${section.heading}\n\n${section.body}`)
    .join('\n\n');
  const faq = article.faq
    .map((item) => `Q. ${item.question}\n\nA. ${item.answer}`)
    .join('\n\n');

  return `# SEO 제목 후보

${titleCandidates}

# 추천 제목

${article.recommendedTitle}

## 디스크립션

${article.description}

## 목차

${toc}

${body}

## FAQ

${faq}

## 해시태그

${article.hashtags.join(' ')}`;
}

export function countKeywordMentions(article, keyword) {
  const target = normalizeKeyword(keyword);
  const sectionsText = (article.sections || [])
    .map((section) => `${section.heading || ''} ${section.body || ''}`)
    .join(' ');
  const faqText = (article.faq || [])
    .map((item) => `${item.question || ''} ${item.answer || ''}`)
    .join(' ');
  const text = `${article.description || ''} ${sectionsText} ${faqText}`;
  return (text.match(new RegExp(escapeRegExp(target), 'g')) || []).length;
}

function normalizeKeyword(keyword) {
  const cleanKeyword = String(keyword || '').replace(/\s+/g, ' ').trim();
  return cleanKeyword || 'SEO 키워드';
}

function normalizeTitleCandidates(candidates, keyword) {
  const normalized = candidates
    .filter(Boolean)
    .map((title) => ensureTitleLength(String(title).trim(), keyword));

  const fallbackTitles = TITLE_PATTERNS.map((pattern) => pattern(keyword)).map((title) => ensureTitleLength(title, keyword));
  return [...new Set([...normalized, ...fallbackTitles])].slice(0, 5);
}

function ensureTitleLength(title, keyword) {
  let result = title.includes(keyword) ? title : `${keyword} ${title}`;
  if (!/\d/.test(result)) {
    result = `${result} 5가지 기준`;
  }

  const suffixes = [
    '꼭 알아야 할 핵심 정보',
    '선택 전 확인해야 할 체크포인트',
    '효과와 주의사항 총정리',
  ];
  let suffixIndex = 0;
  while (result.length < MIN_TITLE_LENGTH) {
    result = `${result} ${suffixes[suffixIndex % suffixes.length]}`;
    suffixIndex += 1;
  }
  return result;
}

function extractInsights(sourceText, keyword) {
  const sentences = String(sourceText || '')
    .replace(/\s+/g, ' ')
    .split(/[.!?。！？\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
    .map((sentence) => sentence.replaceAll(keyword, '이 주제'));

  const fallback = [
    '현재 고민과 필요한 정보를 함께 정리하는 것이 중요합니다',
    '효과, 과정, 비용, 사후 관리 기준을 함께 비교해야 합니다',
    '과장된 표현보다 실제 상황에 맞는 설명을 기준으로 삼는 것이 좋습니다',
  ];

  return [...sentences, ...fallback].slice(0, 8);
}

function buildTableOfContents(keyword, insights) {
  const topicHints = insights
    .slice(0, 2)
    .map((insight) => compactHeading(insight));

  return [
    `${keyword}를 알아보기 전 핵심 정리`,
    ...topicHints,
    ...DEFAULT_TOPICS,
  ].slice(0, 6);
}

function compactHeading(sentence) {
  const words = sentence
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 6);

  return words.length > 0 ? words.join(' ') : '핵심 정보';
}

function buildDescription(keyword, insights, tone) {
  const base = `${keyword}를 찾고 있다면 단순한 광고 문구보다 내 상황에 맞는 기준을 먼저 확인해야 합니다. 이 글은 ${insights[0]}. 또한 효과, 선택 기준, 상담 전 확인할 점, 관리 방법까지 ${tone} 흐름으로 정리해 처음 알아보는 분도 빠르게 판단할 수 있도록 돕습니다.`;
  return fitKoreanLength(base, 200, 300);
}

function buildSections(keyword, headings, insights, targetLength, sourceUrls) {
  const perSection = Math.max(210, Math.floor((targetLength - 450) / headings.length));

  return headings.map((heading, index) => {
    const insight = insights[index % insights.length];
    const keywordPhrase = index === 0 ? `${keyword}를 검색하는 사람이` : '관련 정보를 찾는 사람이';
    const urlNote = sourceUrls[index] ? ' 참고한 자료의 흐름도 함께 반영해 핵심만 정리했습니다.' : '';
    const body = `이 항목에서는 ${keywordPhrase} 가장 먼저 궁금해하는 기준을 중심으로 봅니다. ${insight}. 중요한 점은 한 가지 정보만 보고 판단하기보다 증상, 목적, 기대 효과, 관리 가능성을 함께 비교하는 것입니다. 특히 처음 알아보는 단계라면 상담 전 질문을 미리 정리하고, 본인의 생활 습관이나 불편한 시점을 구체적으로 기록해 두면 선택이 쉬워집니다.${urlNote}`;

    return {
      heading,
      body: expandToLength(body, perSection),
    };
  });
}

function buildFaq(keyword, insights) {
  return [
    {
      question: `${keyword}를 알아볼 때 가장 먼저 확인할 점은 무엇인가요?`,
      answer: `현재 고민과 목적을 먼저 정리한 뒤 효과, 과정, 비용, 관리 방법을 함께 확인하는 것이 좋습니다. ${insights[0]}.`,
    },
    {
      question: '관련 정보는 어떻게 비교하면 좋나요?',
      answer: '한 글의 주장만 보기보다 여러 자료에서 반복되는 공통 내용을 확인하고, 과장된 표현보다 구체적인 설명이 있는지 살펴보는 것이 좋습니다.',
    },
    {
      question: '선택 전 주의할 점이 있나요?',
      answer: '개인 상태에 따라 필요한 과정이 달라질 수 있으므로, 방문 전 상담 항목과 기대 목표를 정리하고 무리한 확정 표현은 신중하게 보는 것이 좋습니다.',
    },
  ];
}

function buildHashtags(keyword, insights) {
  const compactKeyword = `#${keyword.replace(/\s+/g, '')}`;
  const extracted = insights
    .join(' ')
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !keyword.includes(word))
    .slice(0, 4)
    .map((word) => `#${word}`);

  return [...new Set([compactKeyword, ...extracted, '#SEO글쓰기', '#정보성콘텐츠'])].slice(0, 5);
}

function fitKoreanLength(text, min, max) {
  let result = text;
  const addition = ' 핵심을 차분히 비교하면 불필요한 시행착오를 줄일 수 있습니다.';

  while (result.length < min) {
    result += addition;
  }

  if (result.length > max) {
    result = result.slice(0, max - 1);
    const lastSpace = result.lastIndexOf(' ');
    result = result.slice(0, lastSpace > min ? lastSpace : max - 1);
  }

  return result;
}

function expandToLength(text, minLength) {
  let result = text;
  const additions = [
    ' 정보를 정리할 때는 내 상황에 맞는지 확인하는 과정이 필요합니다.',
    ' 검색 결과에서 자주 보이는 표현도 실제 기준과 연결되는지 살펴보면 도움이 됩니다.',
    ' 이렇게 정리하면 단순 홍보성 글보다 판단에 필요한 정보를 중심으로 볼 수 있습니다.',
  ];
  let index = 0;

  while (result.length < minLength) {
    result += additions[index % additions.length];
    index += 1;
  }

  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
