# Korean SEO Article Generator

키워드만 입력하면 자동 검색을 사용해 SEO 제목, 디스크립션, 목차, 본문, FAQ, 해시태그를 생성하는 로컬 웹앱입니다.

## 바로 사용하기

1. `.env.example` 파일을 복사해서 `.env` 파일을 만듭니다.
2. `.env` 안의 `OPENAI_API_KEY`에 본인의 OpenAI API 키를 넣습니다.
3. 아래 명령으로 서버를 실행합니다.

```powershell
node server.js
```

4. 브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173
```

## 동작 방식

- 화면은 `/api/generate`로 요청을 보냅니다.
- 로컬 서버가 `.env`의 `OPENAI_API_KEY`를 사용해 OpenAI Responses API에 요청합니다.
- API 키는 브라우저 코드나 HTML에 노출되지 않습니다.
- 키가 없거나 서버 없이 HTML만 열면 로컬 템플릿 생성으로 자동 전환됩니다.
- 참고 URL과 원문 메모는 선택사항입니다. 특정 자료를 꼭 반영하고 싶을 때만 입력합니다.

## 출력 조건

- SEO 제목 후보 5개
- 추천 제목: `키워드 + 설명 + 숫자`
- 디스크립션 200~300자
- 목차 5~6개
- 소제목별 본문
- FAQ 3개 이상
- 해시태그 5개
- 생성 콘텐츠 안의 키워드 반복 3~4회

## 참고

OpenAI 공식 문서의 Responses API를 사용합니다. 기본 모델은 `.env`의 `OPENAI_MODEL`에서 바꿀 수 있습니다.

## Vercel 배포

GitHub에 올릴 때 `.env` 파일은 올리지 마세요. 실제 API 키는 Vercel 프로젝트의 Environment Variables에 등록합니다.

Vercel 환경변수:

```text
OPENAI_API_KEY=본인_OpenAI_API키
OPENAI_MODEL=gpt-5.5
```

배포 후 화면은 Vercel 주소에서 열리고, 글 생성 요청은 `/api/generate` 서버리스 함수로 처리됩니다.
