export type AccountType = 'bank' | 'credit' | 'cash' | 'savings' | 'crypto';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Currency {
  symbol: string;
  name: string;
  rateToUSD: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO String or YYYY-MM-DDTHH:mm:ss
  account: string; // Account ID
  accountDest?: string | null; // For transfers
  category?: string | null; // For expense/income
  description?: string;
  currency: string;
  userId?: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface BudgetsMap {
  [categoryId: string]: number;
}

export type UserStatus = 'approved' | 'pending' | 'rejected';
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetsMap;
  baseCurrency: string;
  currencies: Record<string, Currency>;
  dateFormat: string;
  showTime: boolean;
  sheetsUrl: string;
  autoSyncSheets: boolean;
}
