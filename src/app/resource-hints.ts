export type ResourceHint = {
  rel: 'preconnect';
  href: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
};

export const resourceHints: ResourceHint[] = [
  { rel: 'preconnect', href: 'https://images.jipsamoye.com' },
  { rel: 'preconnect', href: 'https://api.jipsamoye.com', crossOrigin: 'use-credentials' },
];
