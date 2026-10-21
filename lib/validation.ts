// 인증글 입력 검증 — 'ㄱ', 'ㅋㅋㅋㅋ' 같은 무성의한 글 방지

export const LIMITS = {
  subcategoryMin: 2,
  subcategoryMax: 20,
  textMin: 10, // 일반 분류: 의미 있는 글자 최소
  textMinEtc: 30, // 기타: 의미 있는 글자 최소
  textMax: 300,
  uniqueMin: 6, // 서로 다른 글자 최소
  uniqueMinEtc: 12,
};

/** 완성된 한글 / 영문 / 숫자만 '의미 있는 글자'로 센다 (공백·특수문자·이모지·단독 자모 제외) */
const MEANINGFUL = /[가-힣A-Za-z0-9]/g;

export function meaningfulChars(text: string): string[] {
  return text.match(MEANINGFUL) ?? [];
}

export function meaningfulCount(text: string): number {
  return meaningfulChars(text).length;
}

/** 같은 글자 4번 이상 연속 (3번까지는 허용: 11000원, ㅋㅋㅋ, 11/11) */
export function hasCharRepeat(text: string): boolean {
  return /(\S)\1{3,}/.test(text);
}

/** 2~4글자 묶음이 3번 이상 연속 (ㅋㅎㅋㅎㅋㅎ, 하이하이하이) */
export function hasChunkRepeat(text: string): boolean {
  return /(\S{2,4})\1{2,}/.test(text);
}

/** 비교용 정규화: 공백·특수문자 제거, 소문자 */
export function normalizeForCompare(text: string): string {
  return meaningfulChars(text).join("").toLowerCase();
}

function repeatError(text: string): string | null {
  if (hasCharRepeat(text)) return "같은 글자는 3번까지만 연속으로 쓸 수 있어요";
  if (hasChunkRepeat(text)) return "같은 말을 계속 반복할 수 없어요";
  return null;
}

export function validateSubcategory(text: string): string | null {
  const t = text.trim();
  if (!t) return "무엇을 했는지 골라주세요";
  if (t.length > LIMITS.subcategoryMax) return `소분류는 ${LIMITS.subcategoryMax}자 이내로 적어주세요`;
  if (meaningfulCount(t) < LIMITS.subcategoryMin)
    return `소분류는 ${LIMITS.subcategoryMin}글자 이상 적어주세요`;
  return repeatError(t);
}

export function validateActivityText(text: string, isEtc: boolean): string | null {
  const t = text.trim();
  const min = isEtc ? LIMITS.textMinEtc : LIMITS.textMin;
  const uniqueMin = isEtc ? LIMITS.uniqueMinEtc : LIMITS.uniqueMin;
  if (!t) return "오늘 한 일을 적어주세요";
  if (t.length > LIMITS.textMax) return `${LIMITS.textMax}자 이내로 적어주세요`;
  const rep = repeatError(t);
  if (rep) return rep;
  const chars = meaningfulChars(t);
  if (chars.length < min)
    return `조금 더 자세히 적어주세요 (자음·모음, 공백, 이모지 제외 ${min}자 이상)`;
  if (new Set(chars).size < uniqueMin) return "같은 글자만 반복하지 말고 내용을 적어주세요";
  return null;
}
