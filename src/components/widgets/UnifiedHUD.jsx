'use client';
import BuildsHUD from './BuildsHUD';
import StrategicHUD from './StrategicHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';

export default function UnifiedHUD() {
  return (
    <>
      <BuildsHUD />
      <StrategicHUD />
      <RealtimeCoachHUD />
    </>
  );
}