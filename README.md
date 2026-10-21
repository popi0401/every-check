# everyday — 일일 인증 앱

매일 활동을 인증하고 미참여 시 벌금을 집계하는 모바일 웹앱.

## 기술 스택

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Backend/DB**: Supabase (Auth + PostgreSQL + Storage)
- **배포**: Vercel

---

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일에 Supabase 프로젝트 정보 입력:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Supabase 설정

#### 2-1. DB 스키마 적용

Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용 전체 붙여넣기 후 실행.

주요 내용:
- 테이블 생성 (groups, profiles, group_members, posts, comments, reactions)
- RLS(Row Level Security) 정책 설정
- 신규 사용자 프로필 자동 생성 트리거
- 기본 그룹 1개 생성
- Storage 버킷 생성 및 정책 설정

#### 2-2. Google OAuth 설정

1. Supabase 대시보드 → **Authentication** → **Providers** → **Google** 활성화
2. [Google Cloud Console](https://console.cloud.google.com/)에서 OAuth 2.0 클라이언트 생성
3. 승인된 리디렉션 URI에 `https://your-project.supabase.co/auth/v1/callback` 추가
4. Client ID와 Client Secret을 Supabase Google provider 설정에 입력
5. Supabase 대시보드 → **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000` (개발) / `https://your-domain.vercel.app` (배포)
   - Redirect URLs에 `http://localhost:3000/auth/callback` 추가

#### 2-3. Storage 버킷 확인

SQL 스크립트에서 Storage 버킷이 자동 생성됩니다. 안 된 경우 수동으로:

1. Supabase 대시보드 → **Storage** → **New bucket**
2. `avatars` 버킷: Public 체크
3. `posts` 버킷: Public 체크

### 3. 폰트 설정 (선택)

Freesentation 폰트 사용 시:
1. [Freesentation GitHub](https://github.com/freesentation/freesentation)에서 폰트 다운로드
2. `public/fonts/` 폴더에 추가:
   - `Freesentation-4Regular.ttf`
   - `Freesentation-7Bold.ttf`

폰트 미설치 시 Noto Sans KR(Google Fonts)로 자동 대체됩니다.

### 4. 개발 서버 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속

---

## 관리자 설정

최초 가입한 사용자를 관리자로 지정하려면 Supabase SQL Editor에서 실행:

```sql
UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-id';
```

관리자는 벌금 금액을 설정 페이지에서 변경할 수 있습니다.

---

## Vercel 배포

1. [Vercel](https://vercel.com/)에 GitHub 리포지토리 연결
2. Environment Variables에 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

배포 후 Supabase Authentication → URL Configuration에 배포 URL 추가:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## 앱 구조

```
app/
├── (auth)/login/      # 구글 소셜 로그인
├── auth/callback/     # OAuth 콜백
├── onboarding/        # 닉네임/프로필 설정 (최초 1회)
└── (main)/
    ├── page.tsx       # 홈 피드 (오늘 현황)
    ├── upload/        # 인증 올리기
    ├── calendar/      # 월별 현황 + 벌금 집계
    └── settings/      # 설정

components/
├── BottomNav.tsx      # 하단 탭 네비게이션
├── PostCard.tsx       # 인증 게시물 카드 (반응 포함)
├── EmptyPostCard.tsx  # 미인증 멤버 카드
└── CommentSection.tsx # 댓글 섹션
```
