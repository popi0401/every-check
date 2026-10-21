export type CategoryId =
  | "job"
  | "study"
  | "side_job"
  | "project"
  | "exercise"
  | "reading"
  | "hobby"
  | "self_care"
  | "etc";

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  /** 소분류 예시 칩 (기타는 비어 있음 = 소분류 입력 없음) */
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  { id: "job", label: "취준", emoji: "💼", subcategories: ["자소서", "코딩테스트", "면접 준비", "포트폴리오", "공고 지원"] },
  { id: "study", label: "공부", emoji: "📚", subcategories: ["어학", "자격증", "인강", "전공 공부"] },
  { id: "side_job", label: "부업", emoji: "💰", subcategories: ["스마트스토어", "블로그", "유튜브", "외주·프리랜서", "재테크 공부"] },
  { id: "project", label: "사이드 프로젝트", emoji: "🛠", subcategories: ["개발", "디자인", "글쓰기", "영상 편집"] },
  { id: "exercise", label: "운동", emoji: "🏃", subcategories: ["헬스", "러닝", "홈트", "수영", "등산"] },
  { id: "reading", label: "독서", emoji: "📖", subcategories: ["소설", "자기계발서", "전공서적", "에세이"] },
  { id: "hobby", label: "취미", emoji: "🎨", subcategories: ["악기", "그림", "요리", "사진", "외국어 회화"] },
  { id: "self_care", label: "자기관리", emoji: "🧹", subcategories: ["정리·청소", "가계부", "일기", "식단"] },
  { id: "etc", label: "기타", emoji: "✏️", subcategories: [] },
];

export function getCategory(id: string | null | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
