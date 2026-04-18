'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, SocialLink } from '@/types/api';
import Modal from '@/components/common/Modal';
import { showToast } from '@/components/common/Toast';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: User;
  onSaved: (updatedProfile: User) => void;
}

export default function ProfileEditModal({ isOpen, onClose, profile, onSaved }: ProfileEditModalProps) {
  const router = useRouter();
  const [editNickname, setEditNickname] = useState(profile.nickname);
  const [editBio, setEditBio] = useState(profile.bio || '');
  const [editLinks, setEditLinks] = useState<SocialLink[]>(profile.socialLinks || []);
  const [saving, setSaving] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const nicknameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditNickname(profile.nickname);
      setEditBio(profile.bio || '');
      setEditLinks(profile.socialLinks || []);
      setNicknameStatus('idle');
    }
  }, [isOpen, profile]);

  // 닉네임 실시간 중복 체크 (디바운스 300ms)
  useEffect(() => {
    if (nicknameTimerRef.current) clearTimeout(nicknameTimerRef.current);

    // 현재 닉네임과 같으면 체크 안 함
    if (editNickname === profile.nickname) {
      setNicknameStatus('idle');
      return;
    }

    // 2자 미만이면 invalid
    if (editNickname.trim().length < 2) {
      setNicknameStatus('invalid');
      return;
    }

    setNicknameStatus('checking');
    nicknameTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<boolean>(`/api/users/check-nickname?nickname=${encodeURIComponent(editNickname)}`);
        setNicknameStatus(res.data ? 'available' : 'taken');
      } catch {
        // API 없으면 일단 통과
        setNicknameStatus('available');
      }
    }, 300);

    return () => {
      if (nicknameTimerRef.current) clearTimeout(nicknameTimerRef.current);
    };
  }, [editNickname, profile.nickname]);

  const hasChanges = editNickname !== profile.nickname ||
    editBio !== (profile.bio || '') ||
    JSON.stringify(editLinks) !== JSON.stringify(profile.socialLinks || []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.patch<User>(`/api/users/me`, {
        nickname: editNickname,
        bio: editBio,
        socialLinks: editLinks,
      });
      onSaved(res.data);
      onClose();
      if (res.data.nickname !== profile.nickname) {
        router.push(`/users/${res.data.nickname}`);
      }
    } catch {
      showToast('프로필 수정에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const addLink = (type: 'INSTAGRAM' | 'YOUTUBE') => {
    if (editLinks.some((l) => l.type === type)) return;
    setEditLinks([...editLinks, { type, url: '' }]);
  };

  const updateLinkUrl = (index: number, url: string) => {
    setEditLinks(editLinks.map((l, i) => i === index ? { ...l, url } : l));
  };

  const removeLink = (index: number) => {
    setEditLinks(editLinks.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="프로필 편집">
      <div className="flex flex-col gap-5">
        {/* 닉네임 */}
        <div>
          <label className="block text-sm font-bold mb-2">닉네임</label>
          <div className="relative">
            <input
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value.slice(0, 10))}
              maxLength={10}
              className={`w-full px-4 py-2.5 rounded-xl border bg-gray-50 text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                nicknameStatus === 'taken' || nicknameStatus === 'invalid'
                  ? 'border-red-300 focus:ring-red-300'
                  : nicknameStatus === 'available'
                  ? 'border-green-300 focus:ring-green-300'
                  : 'border-gray-100 focus:ring-amber-300'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {editNickname.length}/10
            </span>
          </div>
          {/* 닉네임 상태 메시지 */}
          {nicknameStatus === 'checking' && (
            <p className="text-xs text-gray-400 mt-1.5">확인 중...</p>
          )}
          {nicknameStatus === 'available' && (
            <p className="text-xs text-green-500 mt-1.5">사용 가능한 닉네임이에요 ✓</p>
          )}
          {nicknameStatus === 'taken' && (
            <p className="text-xs text-red-500 mt-1.5">이미 사용 중인 닉네임이에요</p>
          )}
          {nicknameStatus === 'invalid' && (
            <p className="text-xs text-red-500 mt-1.5">2자 이상 입력해 주세요</p>
          )}
        </div>

        {/* 자기 소개 */}
        <div>
          <label className="block text-sm font-bold mb-2">자기 소개</label>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="자유롭게 소개해주세요."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
          />
        </div>

        {/* 외부 링크 */}
        <div>
          <label className="block text-sm font-bold mb-2">외부 링크</label>
          <div className="flex flex-col gap-3">
            {editLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-24 px-3 py-2 bg-gray-100 rounded-xl text-sm text-center">
                  {link.type === 'INSTAGRAM' ? '인스타그램' : '유튜브'}
                </span>
                <input
                  value={link.url}
                  onChange={(e) => updateLinkUrl(i, e.target.value)}
                  placeholder={link.type === 'INSTAGRAM' ? 'https://instagram.com/...' : 'https://youtube.com/@...'}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all duration-200"
                />
                <button
                  onClick={() => removeLink(i)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {/* 링크 추가 버튼 */}
            <div className="flex gap-2">
              {!editLinks.some((l) => l.type === 'INSTAGRAM') && (
                <button
                  onClick={() => addLink('INSTAGRAM')}
                  className="px-3 py-1.5 border border-gray-100 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200"
                >
                  + 인스타그램
                </button>
              )}
              {!editLinks.some((l) => l.type === 'YOUTUBE') && (
                <button
                  onClick={() => addLink('YOUTUBE')}
                  className="px-3 py-1.5 border border-gray-100 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200"
                >
                  + 유튜브
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSaveProfile}
          disabled={saving || !editNickname.trim() || !hasChanges || nicknameStatus === 'taken' || nicknameStatus === 'invalid' || nicknameStatus === 'checking'}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-200 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '변경 내용 저장'}
        </button>
      </div>
    </Modal>
  );
}
