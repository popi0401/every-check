"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Comment } from "@/types";

interface Props {
  postId: string;
  currentUserId: string;
}

export default function CommentSection({ postId, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("comments")
      .select("*, profiles(*)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setComments((data ?? []) as Comment[]);
        setFetching(false);
      });
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: currentUserId,
        content: input.trim(),
      })
      .select("*, profiles(*)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as Comment]);
      setInput("");
    }
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
      {fetching ? (
        <p className="text-muted text-xs text-center py-2">불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted text-xs text-center py-2">
          첫 댓글을 남겨보세요
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2">
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-border flex-shrink-0 mt-0.5">
                {comment.profiles?.avatar_url ? (
                  <Image
                    src={comment.profiles.avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    👤
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground mr-1.5">
                  {comment.profiles?.nickname}
                </span>
                <span className="text-xs text-foreground/80 break-words">
                  {comment.content}
                </span>
              </div>
              {comment.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-muted hover:text-danger text-xs transition-colors flex-shrink-0"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="댓글 추가... (최대 100자)"
          maxLength={100}
          className="flex-1 bg-border/50 text-foreground placeholder-muted text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="text-primary text-xs font-bold disabled:opacity-40 px-1 transition-opacity"
        >
          {loading ? "..." : "등록"}
        </button>
      </form>
    </div>
  );
}
