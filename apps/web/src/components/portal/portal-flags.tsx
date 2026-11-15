'use client';

import { createContext, useContext } from 'react';

/**
 * Flag fitur untuk komponen klien portal. Nilainya dibaca di server (layout portal) dari FEATURE_FLAGS lalu
 * diteruskan ke sini; hanya untuk tampilan menu, penegakan tetap di API (404 saat OFF).
 */
export interface PortalFlags {
  subscriptions: boolean;
}

const Ctx = createContext<PortalFlags>({ subscriptions: false });

export function PortalFlagsProvider({ value, children }: { value: PortalFlags; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePortalFlags = () => useContext(Ctx);
