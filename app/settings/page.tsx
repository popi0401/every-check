"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Profile, Group } from "@/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fineAmount, setFineAmount] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [savingFine, setSavingFine] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: g }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("groups").select("*").limit(1).single(),
      ]);

      if (p) setProfile(p);
      if (g) {
        setGroup(g);
        setFineAmount(g.fine_amount);
      }
    };
    fetchProfile();
  }, []);

  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const startEditing = () => {
    setEditNickname(profile?.nickname ?? "");
    setAvatarPreview(profile?.avatar_url ?? null);
    setAvatarFile(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editNickname.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let newAvatarUrl = profile?.avatar_url ?? null;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() ?? "jpg";
        const { data: up, error: ue } = await supabase.storage
          .from("avatars")
          .upload(`${user.id}/avatar.${ext}`, avatarFile, { upsert: true });
        if (ue) throw ue;
        newAvatarUrl = supabase.storage
          .from("avatars")
          .getPublicUrl(up.path).data.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ nickname: trimmed, avatar_url: newAvatarUrl })
        .eq("id", user.id);
      if (error) throw error;

      setProfile((prev) =>
        prev ? { ...prev, nickname: trimmed, avatar_url: newAvatarUrl } : prev
      );
      setAvatarFile(null);
      setIsEditing(false);
      showFeedback("success", "프로필이 저장되었습니다 ✓");
      router.refresh();
    } catch (err: unknown) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "오류가 발생했습니다"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFine = async () => {
    if (!profile?.is_admin || !group) return;
    setSavingFine(true);
    try {
      const { error } = await supabase
        .from("groups")
        .update({ fine_amount: fineAmount })
        .eq("id", group.id);
      if (error) throw error;
      showFeedback("success", "벌금 금액이 저장되었습니다 ✓");
    } catch (err: unknown) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "오류가 발생했습니다"
      );
    } finally {
      setSavingFine(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">설정</h1>
      </header>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium transition-all ${
            feedback.type === "success"
              ? "bg-green-500/20 border border-green-500/40 text-green-400"
              : "bg-danger/20 border border-danger/40 text-danger"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <main className="flex-1 px-4 py-6 flex flex-col gap-6 pb-nav">
        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            내 프로필
          </h2>
          {!isEditing ? (
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-border flex-shrink-0">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="프로필"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      👤
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-semibold text-base">
                    {profile?.nickname ?? "닉네임 없음"}
                  </span>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="text-muted hover:text-foreground transition-colors p-1"
                    aria-label="프로필 수정"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSaveProfile}
              className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-4"
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-16 h-16 rounded-full overflow-hidden bg-border flex-shrink-0 hover:ring-2 hover:ring-primary transition-all"
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
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      👤
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
                    <span className="text-white text-[10px] font-medium">
                      변경
                    </span>
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      placeholder="닉네임"
                      maxLength={20}
                      autoFocus
                      className="w-full bg-background text-foreground placeholder-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted/40 pointer-events-none select-none">
                      {editNickname.length}/20
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex-1 bg-border/40 text-muted font-semibold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving || !editNickname.trim()}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all text-sm"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Fine (admin only) */}
        {profile?.is_admin && (
          <section>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
              그룹 설정
            </h2>
            <div className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    1회 미참여 벌금
                  </p>
                  <p className="text-muted text-xs">
                    미인증 1일당 부과되는 금액
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(Number(e.target.value))}
                    min={0}
                    step={100}
                    className="w-24 bg-background text-foreground border border-border rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-primary"
                  />
                  <span className="text-foreground text-sm">원</span>
                </div>
              </div>
              <button
                onClick={handleSaveFine}
                disabled={savingFine}
                className="bg-primary/20 text-primary border border-primary/40 font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all text-sm"
              >
                {savingFine ? "저장 중..." : "저장"}
              </button>
            </div>
          </section>
        )}

        {/* Notification (UI only) */}
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            알림
          </h2>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground text-sm font-semibold">
                  인증 알림 시간
                </p>
                <p className="text-muted text-xs mt-0.5">
                  앱 설치 후 활성화됩니다
                </p>
              </div>
              <div className="opacity-40 pointer-events-none">
                <input
                  type="time"
                  defaultValue="21:00"
                  disabled
                  className="bg-background text-foreground border border-border rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={handleLogout}
            className="w-full bg-card border border-border text-danger font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
          >
            로그아웃
          </button>
        </section>
      </main>
    </div>
  );
}
