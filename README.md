# Reflex - Designer's Reference Archive

디자이너를 위한 웹 레퍼런스 수집 사이트입니다.
이미지를 업로드하면 AI가 분석해서 Figma 컴포넌트 코드를 자동 생성합니다.

## 📁 파일 구조

```
reflex-site/
├── index.html              # 메인 웹사이트
├── netlify.toml            # Netlify 설정
├── netlify/
│   └── functions/
│       └── analyze.js      # AI 분석 API (Netlify Function)
└── README.md
```

## 🚀 Netlify 배포 방법

### 1단계: GitHub에 업로드
1. GitHub에서 새 저장소(Repository) 생성
2. 이 폴더의 모든 파일을 업로드

### 2단계: Netlify 연결
1. [netlify.com](https://netlify.com) 접속 & 로그인
2. "Add new site" → "Import an existing project"
3. GitHub 연결 → 방금 만든 저장소 선택
4. "Deploy" 클릭

### 3단계: API 키 설정 ⚠️ 중요!
1. Netlify 대시보드 → 내 사이트 클릭
2. "Site configuration" → "Environment variables"
3. "Add a variable" 클릭
4. 다음 내용 입력:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (본인의 Anthropic API 키)
5. "Save" 클릭

### 4단계: 재배포
1. "Deploys" 탭으로 이동
2. "Trigger deploy" → "Deploy site" 클릭
3. 배포 완료되면 URL로 접속!

## 🔑 Anthropic API 키 발급 방법

1. [console.anthropic.com](https://console.anthropic.com) 접속
2. 회원가입 또는 로그인
3. "API Keys" 메뉴 클릭
4. "Create Key" 버튼 클릭
5. 생성된 키 복사 (sk-ant-로 시작)

⚠️ API 키는 절대 공개하면 안 됩니다!

## ✨ 기능

- 웹사이트 / 컴포넌트 레퍼런스 수집
- 카테고리 & 태그로 분류
- 검색 기능
- 이미지 업로드 → AI 분석 → Figma 코드 자동 생성
- 브라우저 localStorage에 데이터 저장

## 💡 사용 팁

1. 스크린샷을 업로드하면 AI가 분석합니다
2. 생성된 Figma 코드는 Figma > Plugins > Development > Console에서 실행
3. 데이터는 브라우저에 저장되므로 같은 브라우저로 접속해야 유지됩니다
