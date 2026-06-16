import { Fragment } from 'react';

interface HighlightedTextProps {
  /** 표시할 원본 텍스트 */
  text: string;
  /** 강조할 검색 키워드 (literal substring, 대소문자 무시) */
  keyword: string;
  /** 텍스트 전체에 적용할 추가 클래스 */
  className?: string;
}

/** 정규식 특수문자를 이스케이프해 literal substring 매칭을 안전하게 만든다. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 검색 키워드와 일치하는 구간을 앱 메인(브랜드) 컬러로 강조한다.
 * - keyword 가 비면 text 를 그대로 렌더.
 * - 대소문자 무시 부분일치로 모든 매칭 구간을 text-primary 로 감싼다.
 * - keyword 의 정규식 특수문자는 이스케이프 → "."/"*" 등 입력도 literal 로 안전 처리.
 */
export default function HighlightedText({ text, keyword, className }: HighlightedTextProps) {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // 캡처 그룹으로 split 하면 매칭 구간이 결과 배열에 그대로 보존된다(홀수 인덱스).
  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        // split 의 캡처 결과는 홀수 인덱스가 매칭 구간.
        i % 2 === 1 ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}
