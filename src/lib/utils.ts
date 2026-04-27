export function timeAgo(dateString: string): string {
  const now = Date.now();
  const utcStr = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const date = new Date(utcStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${diffMonth}달 전`;
}

// 7일 이내: 상대 시간 ("방금 전", "N분 전", "N일 전" 등), 7일 이후: "YYYY.MM.DD"
export function timeAgoOrDate(dateString: string): string {
  const now = Date.now();
  const utcStr = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const diffDay = Math.floor((now - new Date(utcStr).getTime()) / (1000 * 60 * 60 * 24));
  return diffDay < 7 ? timeAgo(dateString) : formatDate(dateString);
}

// "YYYY.MM.DD" — trailing dot 없음
export function formatDate(dateString: string): string {
  const utcStr = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const d = new Date(utcStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// "YYYY.MM.DD HH:MM" — trailing dot 없음
export function formatDateTime(dateString: string): string {
  const utcStr = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const d = new Date(utcStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}
