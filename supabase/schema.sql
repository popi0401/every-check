-- ============================================================
-- everyday — 일일 인증 앱 Supabase 스키마
-- Supabase SQL 에디터에서 실행하세요
-- ============================================================

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT,
  fine_amount INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (auth.users와 연결)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Posts (하루 1개 제한: user_id + date unique)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_text TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Comments (100자 이내)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions (post_id + user_id + emoji_type 조합 중복 방지)
CREATE TABLE IF NOT EXISTS reactions (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, emoji_type)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Groups
CREATE POLICY "groups_select" ON groups FOR SELECT USING (true);
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Group members
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (true);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Posts
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Reactions
CREATE POLICY "reactions_select" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON reactions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 신규 사용자 프로필 자동 생성 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 기본 그룹 생성 (1회만 실행)
-- ============================================================

INSERT INTO groups (name, fine_amount)
VALUES ('일일 인증 그룹', 1000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Storage 버킷 생성 (SQL Editor에서 실행 또는 Dashboard에서 수동 생성)
-- ============================================================

-- avatars 버킷 (프로필 사진)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- posts 버킷 (인증 사진)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT DO NOTHING;

-- Storage 정책: 누구나 읽기 가능
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "posts_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'posts');

-- Storage 정책: 본인만 업로드/수정
CREATE POLICY "avatars_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "posts_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 다중 이미지 지원 마이그레이션
-- Supabase SQL 에디터에서 실행하세요
-- ============================================================

-- post_images 테이블 (post당 최대 3장, order 0-based)
CREATE TABLE IF NOT EXISTS post_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_images_select" ON post_images FOR SELECT USING (true);
CREATE POLICY "post_images_insert" ON post_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
);

-- 기존 image_url 데이터를 post_images로 이전
INSERT INTO post_images (post_id, image_url, "order")
SELECT id, image_url, 0 FROM posts
WHERE image_url IS NOT NULL AND image_url != ''
ON CONFLICT DO NOTHING;

-- posts 테이블에서 image_url 컬럼 제거
ALTER TABLE posts DROP COLUMN IF EXISTS image_url;

-- ============================================================
-- 제외일 (개인 또는 그룹 전체)
-- user_id NULL이면 그룹 전체 적용 (관리자 용도)
-- ============================================================

CREATE TABLE IF NOT EXISTS exempt_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 같은 사람이 같은 날짜에 중복 등록 방지
CREATE UNIQUE INDEX IF NOT EXISTS exempt_days_user_date_unique
  ON exempt_days (user_id, date) WHERE user_id IS NOT NULL;

ALTER TABLE exempt_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exempt_days_select" ON exempt_days FOR SELECT USING (true);
CREATE POLICY "exempt_days_insert" ON exempt_days FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exempt_days_delete" ON exempt_days FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 활동 분류 + 무성의한 글 방지 (2026-10)
-- Supabase SQL 에디터에서 실행하세요
-- NOT VALID: 기존 글은 검사하지 않고 새로 올리는 글부터 적용
-- ============================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 대분류 필수 + 허용 목록
ALTER TABLE posts ADD CONSTRAINT posts_category_check CHECK (
  category IN ('job','study','side_job','project','exercise','reading','hobby','self_care','etc')
) NOT VALID;

-- 기타가 아니면 소분류 필수 (2~20자)
ALTER TABLE posts ADD CONSTRAINT posts_subcategory_check CHECK (
  category = 'etc'
  OR (subcategory IS NOT NULL AND char_length(subcategory) <= 20
      AND char_length(regexp_replace(subcategory, '[^가-힣A-Za-z0-9]', '', 'g')) >= 2)
) NOT VALID;

-- 내용: 의미 있는 글자 수(일반 10 / 기타 30), 최대 300자, 같은 글자 4연속 금지
ALTER TABLE posts ADD CONSTRAINT posts_activity_text_check CHECK (
  char_length(activity_text) <= 300
  AND activity_text !~ '(\S)\1{3,}'
  AND char_length(regexp_replace(activity_text, '[^가-힣A-Za-z0-9]', '', 'g'))
      >= CASE WHEN category = 'etc' THEN 30 ELSE 10 END
) NOT VALID;

-- [2026-10-21 추가] 일반 분류 최소 글자 15 → 10 (위 블록을 이미 실행했다면 이것만 실행)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_activity_text_check;
ALTER TABLE posts ADD CONSTRAINT posts_activity_text_check CHECK (
  char_length(activity_text) <= 300
  AND activity_text !~ '(\S)\1{3,}'
  AND char_length(regexp_replace(activity_text, '[^가-힣A-Za-z0-9]', '', 'g'))
      >= CASE WHEN category = 'etc' THEN 30 ELSE 10 END
) NOT VALID;

-- ============================================================
-- [2026-10-21] 인증글 수정: 당일 1회만, 분류·소분류·내용만
-- ============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.posts_guard_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '날짜나 작성자는 바꿀 수 없어요';
  END IF;
  IF OLD.edited_at IS NOT NULL THEN
    RAISE EXCEPTION '오늘 수정 기회를 이미 사용했어요';
  END IF;
  IF OLD.date <> (NOW() AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION '지난 인증은 수정할 수 없어요';
  END IF;
  NEW.edited_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_guard_update ON posts;
CREATE TRIGGER posts_guard_update
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_guard_update();
