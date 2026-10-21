import Image from "next/image";
import Link from "next/link";
import { Profile } from "@/types";

interface Props {
  profile: Profile;
  isCurrentUser: boolean;
}

export default function EmptyPostCard({ profile, isCurrentUser }: Props) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border opacity-40">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-border flex-shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.nickname ?? ""}
              fill
              className="object-cover grayscale"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              👤
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-foreground font-medium text-sm">
            {profile.nickname}
          </p>
          <p className="text-muted text-xs">아직 인증 안 함</p>
        </div>
        {isCurrentUser && (
          <Link
            href="/upload"
            className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-medium active:scale-95 transition-all"
          >
            인증하기
          </Link>
        )}
      </div>
    </div>
  );
}
