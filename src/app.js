import { articleToMarkdown } from './seoGenerator.js';
import { buildApiRequestPayload, requestArticleDraft } from './apiConnectors.js';

const form = document.querySelector('#article-form');
const result = document.querySelector('#result');
const copyButton = document.querySelector('#copy-button');
const downloadButton = document.querySelector('#download-button');
const characterCount = document.querySelector('#character-count');
const keywordCount = document.querySelector('#keyword-count');
const apiStatus = document.querySelector('#api-status');

let latestMarkdown = '';
let latestKeyword = 'seo-article';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('자동 검색 중입니다...');
  renderLoading();

  const payload = readFormPayload();

  try {
    const apiResult = await requestArticleDraft({
      endpoint: '/api/generate',
      payload,
    });
    const article = apiResult.article;
    latestKeyword = article.keyword;
    latestMarkdown = articleToMarkdown(article);
    setStatus('자동 검색 기반 글 생성 완료');
    renderArticle(article, apiResult.mode);
  } catch (error) {
    latestMarkdown = '';
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    setStatus('자동 검색 생성 실패');
    renderError(message);
  }
});

copyButton.addEventListener('click', async () => {
  if (!latestMarkdown) return;
  await navigator.clipboard.writeText(latestMarkdown);
  flashButton(copyButton, '복사 완료');
});

downloadButton.addEventListener('click', () => {
  if (!latestMarkdown) return;
  const blob = new Blob([latestMarkdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(latestKeyword)}-seo-article.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

function readFormPayload() {
  const formData = new FormData(form);
  const sourceUrls = document
    .querySelector('#source-urls')
    .value.split('\n')
    .map((url) => url.trim())
    .filter(Boolean);

  return buildApiRequestPayload({
    keyword: String(formData.get('keyword') || '').trim(),
    sourceUrls,
    sourceText: document.querySelector('#source-text').value,
    targetLength: Number(formData.get('targetLength') || 2000),
    tone: String(formData.get('tone') || '친절하고 전문적인'),
  });
}

function renderArticle(article, mode) {
  result.classList.remove('empty-state');
  result.innerHTML = `
    <p class="source-note">${mode === 'openai_web_search' ? 'OpenAI 자동 검색 결과를 반영했습니다.' : '생성 결과입니다.'}</p>

    <h3>SEO 제목 후보</h3>
    <ol>${article.titleCandidates.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ol>

    <h3>추천 제목</h3>
    <p class="recommended">${escapeHtml(article.recommendedTitle)}</p>

    <h3>디스크립션</h3>
    <p>${escapeHtml(article.description)}</p>

    <h3>목차</h3>
    <ol>${article.tableOfContents.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>

    ${article.sections
      .map(
        (section) => `
          <h3>${escapeHtml(section.heading)}</h3>
          <p>${escapeHtml(section.body)}</p>
        `,
      )
      .join('')}

    <h3>FAQ</h3>
    ${article.faq
      .map(
        (item) => `
          <h4>Q. ${escapeHtml(item.question)}</h4>
          <p>A. ${escapeHtml(item.answer)}</p>
        `,
      )
      .join('')}

    <h3>해시태그</h3>
    <ul class="hashtag-list">${article.hashtags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>
  `;
  characterCount.textContent = `${latestMarkdown.length.toLocaleString('ko-KR')}자`;
  keywordCount.textContent = `키워드 ${article.keywordMentionCount ?? 0}회`;
}

function renderLoading() {
  result.classList.remove('empty-state');
  result.innerHTML = `
    <h3>자동 검색을 실행하고 있습니다.</h3>
    <p>키워드와 관련된 최신 정보를 확인한 뒤 SEO 구조로 글을 생성합니다.</p>
  `;
  characterCount.textContent = '0자';
  keywordCount.textContent = '키워드 0회';
}

function renderError(message) {
  result.classList.remove('empty-state');
  result.innerHTML = `
    <h3>자동 검색을 실행하려면 서버와 API 키가 필요합니다.</h3>
    <p>${escapeHtml(message)}</p>
    <p>프로젝트 폴더에서 <code>node server.js</code>로 실행하고, <code>.env</code>에 <code>OPENAI_API_KEY</code>를 넣어주세요.</p>
  `;
  characterCount.textContent = '0자';
  keywordCount.textContent = '키워드 0회';
}

function setStatus(message) {
  if (apiStatus) {
    apiStatus.textContent = message;
  }
}

function flashButton(button, label) {
  const previous = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1400);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seo-article';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
