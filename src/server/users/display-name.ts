const instructorNames: Record<string, string> = { '01099998888': '김서준 강사', '01099997777': '이지우 강사' };
export function instructorDisplayName(phone: string | null): string { return phone ? instructorNames[phone] ?? '강사' : '강사 미정'; }
