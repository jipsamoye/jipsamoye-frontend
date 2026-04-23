'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { api } from '@/lib/api';
import { PresignedUrlResponse } from '@/types/api';
import { compressImage, extFromMimeType } from '@/lib/imageCompress';
import { showToast } from '@/components/common/Toast';

interface BoardEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TEXT_COLORS = [
  { label: '검정', value: '#191919' },
  { label: '회색', value: '#8b95a1' },
  { label: '빨강', value: '#f04452' },
  { label: '주황', value: '#ff734c' },
  { label: '파랑', value: '#3182f6' },
  { label: '초록', value: '#30b53a' },
];

const HIGHLIGHT_COLORS = [
  { label: '없음', value: null },
  { label: '노랑', value: '#fff59d' },
  { label: '분홍', value: '#ffcdd2' },
  { label: '초록', value: '#c8e6c9' },
  { label: '파랑', value: '#bbdefb' },
];

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center w-9 h-9 rounded-lg text-sm transition-colors
        ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ColorDropdown({
  editor,
  type,
}: {
  editor: Editor;
  type: 'color' | 'highlight';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colors = type === 'color' ? TEXT_COLORS : HIGHLIGHT_COLORS;

  const apply = (value: string | null) => {
    if (type === 'color') {
      if (value) editor.chain().focus().setColor(value).run();
      else editor.chain().focus().unsetColor().run();
    } else {
      if (value) editor.chain().focus().toggleHighlight({ color: value }).run();
      else editor.chain().focus().unsetHighlight().run();
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 h-9 px-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        title={type === 'color' ? '글자 색' : '하이라이트'}
      >
        {type === 'color' ? (
          <span className="text-sm font-bold">A</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.627-1.627L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
          </svg>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-gray-400">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-2 flex gap-1 z-20">
          {colors.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => apply(c.value)}
              title={c.label}
              className="w-6 h-6 rounded-md border border-gray-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: c.value ?? 'transparent' }}
            >
              {!c.value && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 mx-auto">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardEditor({ value, onChange, placeholder = '내용을 입력해주세요' }: BoardEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: 'text-amber-500 underline' },
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ HTMLAttributes: { class: 'rounded-xl my-4 max-w-full' } }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value (e.g., edit page prefill)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const handleImageUpload = async (file: File) => {
    try {
      // fast path에서 원본이 그대로 반환될 수 있어 직렬 처리 필요 (S3 메타/바이트 정합성).
      const compressed = await compressImage(file, 'post');
      const res = await api.post<PresignedUrlResponse>('/api/images/presigned-url', {
        dirName: 'boards',
        ext: extFromMimeType(compressed.type),
      });
      await fetch(res.data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      });
      editor?.chain().focus().setImage({ src: res.data.imageUrl }).run();
    } catch {
      showToast('이미지 업로드에 실패했어요');
    }
  };

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImageUpload(file);
    e.target.value = '';
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('링크 주소를 입력하세요', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    let safeUrl = url;
    if (!/^https?:\/\//i.test(safeUrl)) safeUrl = 'https://' + safeUrl;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safeUrl }).run();
  };

  if (!editor) {
    return <div className="min-h-[500px] border border-gray-200 rounded-xl bg-gray-50 animate-pulse" />;
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="실행 취소"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="다시 실행"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
          </svg>
        </ToolbarButton>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="제목 1"
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="제목 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="굵게"
        >
          <span className="text-sm font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="기울임"
        >
          <span className="text-sm italic font-serif">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="밑줄"
        >
          <span className="text-sm underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="취소선"
        >
          <span className="text-sm line-through">S</span>
        </ToolbarButton>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <ColorDropdown editor={editor} type="color" />
        <ColorDropdown editor={editor} type="highlight" />
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={setLink}
          title="링크"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()} title="이미지">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onImageChange}
        />
      </div>
      <EditorContent editor={editor} />
      {editor.isEmpty && (
        <div className="pointer-events-none absolute px-4 py-3 text-gray-400 text-sm" style={{ marginTop: '-3rem' }}>
          {placeholder}
        </div>
      )}
    </div>
  );
}
