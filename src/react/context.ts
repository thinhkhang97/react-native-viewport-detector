import { createContext } from 'react';
import type { Engine, RootHandle } from '../engine/types';

export interface ViewportContextValue {
  engine: Engine;
  root: RootHandle | null;
}

export const ViewportContext = createContext<ViewportContextValue | null>(null);
