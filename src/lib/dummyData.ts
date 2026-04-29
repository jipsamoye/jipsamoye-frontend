import { PetPostListItem } from '@/types/api';

const dogImages = [
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&h=400&fit=crop',
];

const catImages = [
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop',
];

const allImages = [...dogImages, ...catImages];

const titles = [
  '우리 초코 산책 다녀왔어요!',
  '냥이 낮잠 자는 모습 너무 귀여워',
  '오늘 목욕했더니 삐졌어요 ㅋㅋ',
  '간식 달라고 졸졸 따라다녀요',
  '새로 산 장난감에 푹 빠졌어요',
  '우리 집 고양이 자랑합니다!',
  '산책 중에 친구 만났어요',
  '이 표정 보세요 ㅋㅋㅋ',
  '오늘의 귀여운 포즈',
  '잠자는 모습이 천사같아요',
];

const nicknames = [
  '멍집사', '냥집사', '초코맘', '루이아빠', '모카집사',
  '나비엄마', '복실이네', '치즈냥', '뽀삐맘', '콩이아빠',
];

export const dummyPopularPosts: PetPostListItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: titles[i % titles.length],
  thumbnailUrl: allImages[i % allImages.length],
  likeCount: Math.floor(Math.random() * 200) + 50,
  commentCount: Math.floor(Math.random() * 50),
  nickname: nicknames[i % nicknames.length],
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
}));

export const dummyLatestPosts: PetPostListItem[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 100,
  title: titles[i % titles.length],
  thumbnailUrl: allImages[i % allImages.length],
  likeCount: Math.floor(Math.random() * 100),
  commentCount: Math.floor(Math.random() * 30),
  nickname: nicknames[i % nicknames.length],
  createdAt: new Date(Date.now() - i * 1800000).toISOString(),
}));
