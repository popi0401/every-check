"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Post, PostImage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import CommentSection from "./CommentSection";
import { getCategory } from "@/lib/categories";

const COMMON_EMOJIS = [
  "🔥", "👍", "❤️", "😂", "😮", "😢",
  "👏", "🎉", "💪", "🏃", "✨", "💯",
  "🙏", "😊", "🤩", "😎", "🥳", "🤣",
  "👀", "🫡", "🥹", "⚡", "🌟", "🎯",
];

interface Props {
  post: Post;
  currentUserId: string;
}

export default function PostCard({ post, currentUserId }: Props) {
  const [reactions, setReactions] = useState(post.reactions ?? []);
  const [showComments, setShowComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null); // null = closed, number = index
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const lbTouchStartX = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const commentCount = post.comments?.length ?? 0;
  const supabase = createClient();
  const pickerRef = useRef<HTMLDivElement>(null);

  const images: PostImage[] = post.images ?? [];
  const category = getCategory(post.category);

  // 카드 이미지 터치
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    suppressClick.current = false;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const duration = Date.now() - touchStartTime.current;
    touchStartX.current = null;

    if (Math.abs(delta) >= 40) {
      // 스와이프 → 이미지 전환
      suppressClick.current = true;
      if (delta < 0 && imageIndex < images.length - 1) setImageIndex((i) => i + 1);
      else if (delta > 0 && imageIndex > 0) setImageIndex((i) => i - 1);
    } else if (duration >= 300) {
      // 꾹 누름 → 클릭만 차단
      suppressClick.current = true;
    }
    // 빠른 탭(duration < 300, delta < 40) → suppressClick = false → onClick 라이트박스
  };

  // 라이트박스 스와이프
  const handleLbTouchStart = (e: React.TouchEvent) => {
    lbTouchStartX.current = e.touches[0].clientX;
  };
  const handleLbTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStartX.current === null || lightbox === null) return;
    const delta = e.changedTouches[0].clientX - lbTouchStartX.current;
    lbTouchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0 && lightbox < images.length - 1) setLightbox((i) => i! + 1);
    else if (delta > 0 && lightbox > 0) setLightbox((i) => i! - 1);
  };

  // 라이트박스 열릴 때 스크롤 잠금
  useEffect(() => {
    if (lightbox !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const uniqueEmojis = Array.from(new Set(reactions.map((r) => r.emoji_type)));

  const getReactionCount = (emoji: string) =>
    reactions.filter((r) => r.emoji_type === emoji).length;

  const hasUserReacted = (emoji: string) =>
    reactions.some((r) => r.user_id === currentUserId && r.emoji_type === emoji);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!currentUserId) return;
      const alreadyReacted = reactions.some(
        (r) => r.user_id === currentUserId && r.emoji_type === emoji
      );

      if (alreadyReacted) {
        setReactions((prev) =>
          prev.filter(
            (r) => !(r.user_id === currentUserId && r.emoji_type === emoji)
          )
        );
        await supabase
          .from("reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId)
          .eq("emoji_type", emoji);
      } else {
        const newReaction = {
          post_id: post.id,
          user_id: currentUserId,
          emoji_type: emoji,
          created_at: new Date().toISOString(),
        };
        setReactions((prev) => [...prev, newReaction]);
        await supabase.from("reactions").insert(newReaction);
      }
    },
    [reactions, currentUserId, post.id, supabase]
  );

  const timeAgo = formatTimeAgo(post.created_at);

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-border flex-shrink-0">
          {post.profiles?.avatar_url ? (
            <Image
              src={post.profiles.avatar_url}
              alt={post.profiles.nickname ?? ""}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-base">
              👤
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-foreground font-semibold text-sm">
            {post.profiles?.nickname}
          </p>
          <p className="text-muted text-xs">{timeAgo}</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-500" title="인증 완료" />
      </div>

      {/* Category badge */}
      {category && (
        <div className="px-4 pb-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            <span>{category.emoji}</span>
            <span>{category.label}</span>
            {post.subcategory && (
              <>
                <span className="opacity-60">·</span>
                <span>{post.subcategory}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Activity Text */}
      {post.activity_text && (
        <p className="px-4 pb-3 text-foreground text-sm leading-relaxed">
          {post.activity_text}
        </p>
      )}

      {/* Image carousel */}
      {images.length > 0 && (
        <div
          className="relative w-full aspect-[4/3] bg-border overflow-hidden select-none cursor-zoom-in"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            setLightbox(imageIndex);
          }}
        >
          <Image
            src={images[imageIndex].image_url}
            alt="인증 사진"
            fill
            className="object-cover"
            sizes="(max-width: 430px) 100vw, 430px"
          />
          {/* 이전/다음 버튼 */}
          {imageIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); setImageIndex((i) => i - 1); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          {imageIndex < images.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); setImageIndex((i) => i + 1); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImageIndex(i); }}
                  className={`rounded-full transition-all ${
                    i === imageIndex
                      ? "w-2 h-2 bg-white"
                      : "w-1.5 h-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
          {/* image count badge */}
          {images.length > 1 && (
            <div className="absolute top-2.5 right-2.5 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {imageIndex + 1}/{images.length}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
          onClick={() => setLightbox(null)}
          onTouchStart={handleLbTouchStart}
          onTouchEnd={handleLbTouchEnd}
        >
          {/* 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white z-10"
            onClick={() => setLightbox(null)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* 이미지 */}
          <div
            className="relative w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightbox].image_url}
              alt="원본 사진"
              fill
              className="object-contain"
              sizes="100vw"
              unoptimized
            />
          </div>

          {/* dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={`rounded-full transition-all ${
                    i === lightbox ? "w-2.5 h-2.5 bg-white" : "w-2 h-2 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}

          {/* 좌우 화살표 (이미지 여러 장일 때) */}
          {images.length > 1 && lightbox > 0 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => i! - 1); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          {images.length > 1 && lightbox < images.length - 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => i! + 1); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="px-4 pt-3 pb-3 flex flex-col gap-2.5">
        {/* Reactions */}
        <div className="flex gap-2 flex-wrap items-center">
          {uniqueEmojis.map((emoji) => {
            const count = getReactionCount(emoji);
            const active = hasUserReacted(emoji);
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all active:scale-90 ${
                  active
                    ? "bg-primary/20 border border-primary text-primary"
                    : "bg-border/60 border border-transparent text-foreground hover:border-border"
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && (
                  <span className="text-xs font-medium">{count}</span>
                )}
              </button>
            );
          })}

          {/* + Emoji picker button */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-border/60 border border-transparent hover:border-border text-muted hover:text-foreground text-sm font-bold transition-all active:scale-90"
            >
              +
            </button>
            {showPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-card border border-border rounded-2xl shadow-xl p-2 w-[216px]">
                <div className="grid grid-cols-6 gap-0.5">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        toggleReaction(emoji);
                        setShowPicker(false);
                      }}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg text-lg transition-all active:scale-90 hover:bg-border ${
                        hasUserReacted(emoji) ? "bg-primary/20" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comment toggle — 날짜 무관하게 항상 표시 */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-muted text-xs self-start"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span>
            {commentCount > 0 ? `댓글 ${commentCount}개` : "댓글"}{" "}
            {showComments ? "접기" : "보기"}
          </span>
        </button>
      </div>

      {/* Comments — 날짜 무관하게 항상 표시 */}
      {showComments && (
        <CommentSection postId={post.id} currentUserId={currentUserId} />
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  // 업로드한 시각을 한국 시간 24시간제로 표시 (예: 09:05, 23:41)
  return new Date(dateStr).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
