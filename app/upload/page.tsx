"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CategoryId, getCategory } from "@/lib/categories";
import {
  LIMITS,
  meaningfulCount,
  normalizeForCompare,
  validateActivityText,
  validateSubcategory,
} from "@/lib/validation";

const MAX_IMAGES = 3;

function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default function UploadPage() {
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [subcategory, setSubcategory] = useState("");
  const [customSub, setCustomSub] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const selectedCategory = getCategory(category);
  const isEtc = category === "etc";
  const subError = category && !isEtc ? validateSubcategory(subcategory) : null;
  const textError = category ? validateActivityText(activityText, isEtc) : null;
  const textMin = isEtc ? LIMITS.textMinEtc : LIMITS.textMin;
  const textCount = meaningfulCount(activityText);
  const isValid =
    !!category && !subError && !textError && imageFiles.length > 0;

  const selectCategory = (id: CategoryId) => {
    if (id === category) return;
    setCategory(id);
    setSubcategory("");
    setCustomSub(false);
    setError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const merged = [...imageFiles, ...selected].slice(0, MAX_IMAGES);
    setImageFiles(merged);
    setImagePreviews(merged.map((f) => URL.createObjectURL(f)));
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError("오늘 무엇을 했는지 분류를 골라주세요");
      return;
    }
    const firstError = subError ?? textError;
    if (firstError) {
      setError(firstError);
      return;
    }
    if (imageFiles.length === 0) {
      setError("인증 사진을 1장 이상 선택해주세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = getTodayKST();

      // 오늘 이미 올린 게시물 확인
      const { data: existing } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (existing) {
        setError("오늘은 이미 인증했습니다 🎉");
        setLoading(false);
        return;
      }

      // 직전 인증글과 똑같은 내용 금지
      const { data: lastPost } = await supabase
        .from("posts")
        .select("activity_text")
        .eq("user_id", user.id)
        .lt("date", today)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        lastPost?.activity_text &&
        normalizeForCompare(lastPost.activity_text) ===
          normalizeForCompare(activityText)
      ) {
        setError("지난번 인증과 똑같은 내용이에요. 오늘 한 일을 새로 적어주세요");
        setLoading(false);
        return;
      }

      // 이미지 업로드
      const uploadedUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const ext = file.name.split(".").pop() ?? "jpg";
        const filePath = `${user.id}/${today}-${Date.now()}-${i}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, file, { cacheControl: "3600" });
        if (uploadError) throw uploadError;
        const url = supabase.storage
          .from("posts")
          .getPublicUrl(uploadData.path).data.publicUrl;
        uploadedUrls.push(url);
      }

      // 그룹 조회
      const { data: group } = await supabase
        .from("groups")
        .select("id")
        .limit(1)
        .single();
      if (!group) throw new Error("그룹을 찾을 수 없습니다");

      // 포스트 생성
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          group_id: group.id,
          date: today,
          category,
          subcategory: isEtc ? null : subcategory.trim(),
          activity_text: activityText.trim(),
        })
        .select("id")
        .single();
      if (postError) throw postError;

      // post_images 삽입
      const { error: imagesError } = await supabase
        .from("post_images")
        .insert(
          uploadedUrls.map((image_url, order) => ({
            post_id: post.id,
            image_url,
            order,
          }))
        );
      if (imagesError) throw imagesError;

      window.location.href = "/";
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "오류가 발생했습니다";
      setError(
        msg.includes("check constraint")
          ? "입력 내용이 인증 조건에 맞지 않아요. 내용을 조금 더 자세히 적어주세요"
          : msg
      );
      setLoading(false);
    }
  };

  const canAddMore = imageFiles.length < MAX_IMAGES;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-40">
        <button
          onClick={() => router.back()}
          className="text-muted hover:text-foreground transition-colors p-1"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">오늘의 인증</h1>
      </header>

      <form
        id="upload-form"
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col gap-5 p-4 pb-6"
      >
        {/* Category */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-foreground">오늘은 뭘 했어요?</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCategory(c.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-card border-border text-foreground hover:border-muted"
                  }`}
                >
                  <span className="text-xl leading-none">{c.emoji}</span>
                  <span className="leading-tight text-center">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subcategory */}
        {selectedCategory && !isEtc && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground">
              {selectedCategory.label} 중에 어떤 걸 했나요?{" "}
              <span className="text-danger text-xs font-normal">필수</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedCategory.subcategories.map((sub) => {
                const active = !customSub && subcategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setCustomSub(false);
                      setSubcategory(sub);
                    }}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      active
                        ? "bg-primary border-primary text-white"
                        : "bg-card border-border text-foreground hover:border-muted"
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomSub(true);
                  setSubcategory("");
                }}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  customSub
                    ? "bg-primary border-primary text-white"
                    : "bg-card border-dashed border-border text-muted hover:border-muted"
                }`}
              >
                + 직접 입력
              </button>
            </div>
            {customSub && (
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="예) 토익 스피킹, 기타 연습"
                maxLength={LIMITS.subcategoryMax}
                autoFocus
                className="bg-card text-foreground placeholder-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            )}
            {customSub && subcategory.trim() && subError && (
              <p className="text-danger text-xs">{subError}</p>
            )}
          </div>
        )}

        {/* Photo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-semibold text-foreground">
              인증 사진{" "}
              <span className="text-danger text-xs font-normal">필수</span>
            </label>
            <span className="text-muted text-xs">
              {imageFiles.length}/{MAX_IMAGES}장
            </span>
          </div>

          {/* Preview grid */}
          {imagePreviews.length > 0 && (
            <div className="flex gap-2">
              {imagePreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative flex-1 aspect-square rounded-xl overflow-hidden bg-border"
                >
                  <Image
                    src={src}
                    alt={`미리보기 ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white text-xs leading-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* 추가 슬롯 */}
              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-1 text-muted"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-xs">추가</span>
                </button>
              )}
            </div>
          )}

          {/* 첫 장 선택 버튼 */}
          {imagePreviews.length === 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-card border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3 text-muted">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium">사진 선택하기</p>
                  <p className="text-xs mt-0.5">최대 {MAX_IMAGES}장 · 앨범 또는 카메라</p>
                </div>
              </div>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Activity Text */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground">
            {isEtc ? "오늘 무엇을 했나요?" : "오늘 한 일"}{" "}
            <span className="text-danger text-xs font-normal">필수</span>
          </label>
          <textarea
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            disabled={!category}
            placeholder={
              !category
                ? "먼저 위에서 분류를 골라주세요"
                : isEtc
                ? `무엇을 했는지, 어떻게 했는지 자세히 적어주세요 (${LIMITS.textMinEtc}자 이상)\n예) 동네 도서관 봉사활동에 참여해서 아이들 책 정리와 대출 반납을 2시간 도왔다`
                : `오늘 한 일을 구체적으로 적어주세요 (${LIMITS.textMin}자 이상)\n예) 백준 실버 문제 3개 풀고 오답 정리까지 했다`
            }
            maxLength={LIMITS.textMax}
            rows={isEtc ? 6 : 4}
            className="bg-card text-foreground placeholder-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed disabled:opacity-50"
          />
          <div className="flex items-start justify-between gap-3 text-xs">
            <p className="text-danger">
              {activityText.trim() && textError ? textError : ""}
            </p>
            <p className={`shrink-0 ${textCount >= textMin ? "text-primary" : "text-muted"}`}>
              {Math.min(textCount, textMin)}/{textMin}자
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isValid}
          className="mt-5 w-full bg-primary text-white text-base font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {loading ? "올리는 중..." : "인증 올리기"}
        </button>
      </form>
    </div>
  );
}
