import { createContext, useContext } from 'react';

export type Row = Record<string, any>;

export interface AdminCtx {
  user: { id: number; email: string; name: string };
  addInquiry: (preset?: Row) => void;
  openInquiry: (id: number) => void;
  openEvent: (id: number) => void;
  addEvent: () => void;
  addExpense: (preset?: Row) => void;
  editExpense: (row: Row) => void;
  logout: () => void;
}

export const Ctx = createContext<AdminCtx>(null as unknown as AdminCtx);
export const useAdmin = () => useContext(Ctx);
