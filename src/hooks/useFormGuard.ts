import { useEffect } from 'react';
import { useNavigationGuard } from '@/components/providers/NavigationGuard';

export function useFormGuard(isDirty: boolean, message: string) {
  const { setBlocked } = useNavigationGuard();

  useEffect(() => {
    setBlocked(isDirty, message);
    return () => setBlocked(false);
  }, [isDirty, message, setBlocked]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
