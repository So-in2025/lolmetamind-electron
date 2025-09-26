'use client';
import UnifiedHUD from '@/components/widgets/UnifiedHUD';
import { ScaleProvider } from '@/context/ScaleContext';

export default function OverlayPage() {
  return (
    <ScaleProvider>
      <UnifiedHUD />
    </ScaleProvider>
  );
}