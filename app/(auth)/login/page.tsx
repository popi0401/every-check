"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter/i.test(ua);
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [inApp, setInApp] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    setInApp(isInAppBrowser());
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push("/");
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              every<span className="text-primary">day</span>
            </h1>
            <p className="text-muted text-sm mt-2 leading-relaxed">
              매일 활동을 인증하고
              <br />
              함께 성장하세요
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="w-full bg-card rounded-2xl p-5 flex flex-col gap-3 border border-border">
          {[
            { icon: "📸", text: "오늘의 활동 사진으로 인증" },
            { icon: "🔥", text: "멤버들과 함께 동기부여" },
            { icon: "💰", text: "미참여 시 벌금으로 각오" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <span className="text-foreground text-sm">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Kakao Login — 항상 표시 */}
        <button
          onClick={handleKakaoLogin}
          disabled={loading}
          className="w-full font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-60"
          style={{ backgroundColor: "#FEE500", color: "#000000" }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#000000">
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.612 5.074 4.047 6.538L5.1 20.85a.3.3 0 0 0 .438.327l4.254-2.82A11.3 11.3 0 0 0 12 18.6c5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
            </svg>
          )}
          <span>{loading ? "로그인 중..." : "카카오로 계속하기"}</span>
        </button>

        {/* Google Login — 인앱 브라우저에서는 안내로 대체 */}
        {inApp ? (
          <div className="w-full bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-muted text-xs text-center leading-relaxed">
              구글 로그인은 외부 브라우저에서만 가능합니다.
              <br />
              카카오 로그인을 이용해 주세요.
            </p>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-gray-800 font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{loading ? "로그인 중..." : "Google로 계속하기"}</span>
          </button>
        )}

        <p className="text-muted text-xs text-center">
          로그인하면 서비스 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  );
}
