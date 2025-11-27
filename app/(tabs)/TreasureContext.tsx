import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Treasure } from './InteractiveMap';

const INITIAL_TREASURES: Treasure[] = [
  { id: 't1', lat: 26.5266503, lon: 128.03003221, qrCodeId: 'QR_TREASURE_001', status: 'unfound', point: 100 },
  { id: 't2', lat: 26.52670909, lon: 128.03054853, qrCodeId: 'QR_TREASURE_002', status: 'unfound', point: 100 },
  { id: 't3', lat: 26.52673549, lon: 128.02957221, qrCodeId: 'QR_TREASURE_003', status: 'unfound', point: 100 },
];

type TreasureContextType = {
  treasures: Treasure[];
  setTreasures: React.Dispatch<React.SetStateAction<Treasure[]>>;
  resetStatus: () => void;
  resetAll: () => void;
};

const TreasureContext = createContext<TreasureContextType | undefined>(undefined);

export const TreasureProvider = ({ children }: { children: ReactNode }) => {
  const [treasures, setTreasures] = useState<Treasure[]>(INITIAL_TREASURES);

  const resetStatus = () => {
    setTreasures(prev => prev.map(t => ({ ...t, status: 'unfound' })));
  };

  const resetAll = () => {
    setTreasures(INITIAL_TREASURES);
  };

  return (
    <TreasureContext.Provider value={{ treasures, setTreasures, resetStatus, resetAll }}>
      {children}
    </TreasureContext.Provider>
  );
};

export const useTreasures = () => {
  const context = useContext(TreasureContext);
  if (!context) throw new Error('useTreasures must be used within TreasureProvider');
  return context;
};
