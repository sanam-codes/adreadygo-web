import { createContext, useContext } from 'react';
import type { Business } from './api';
export const WorkspaceContext = createContext<Business | null>(null);
export function useWorkspace() {
  const business = useContext(WorkspaceContext);
  if (!business) throw Error('Choose a business');
  return { business, base: '/businesses/' + business.id, owner: business.role === 'OWNER' };
}
