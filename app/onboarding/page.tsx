"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function OnboardingPage() {
  const [nickname, setNickname] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [googleAvatar, setGoogleAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.avatar_url) {
        setGoogleAvatar(user.user_metadata.avatar_url);
        setAvatarPreview(user.user_metadata.avatar_url);
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요");
      return;
    }
    if (trimmed.length > 20) {
      setError("닉네임은 20자 이내로 입력해주세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let avatarUrl: string | null = googleAvatar;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from("avatars")
            .upload(`${user.id}/avatar.${ext}`, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage
          .from("avatars")
          .getPublicUrl(uploadData.path).data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname: trimmed, avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            프로필 설정
          </h1>
          <p className="text-muted text-sm">어떻게 불릴지 알려주세요</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden bg-card border-2 border-border hover:border-primary transition-colors"
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="프로필"
                  fill
                  className="object-cover"
                  unoptimized={avatarPreview.startsWith("blob:")}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">
                  👤
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">변경</span>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-muted text-xs">
              {googleAvatar
                ? "구글 프로필 사진 사용 중 (탭하여 변경)"
                : "프로필 사진 선택 (선택)"}
            </p>
          </div>

          {/* Nickname */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground text-sm font-medium">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 입력 (최대 20자)"
              maxLength={20}
              className="bg-card text-foreground placeholder-muted border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-orange-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "저장 중..." : "시작하기 →"}
          </button>
        </form>
      </div>
    </div>
  );
}
