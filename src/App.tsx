import React, { useState, useEffect } from 'react';
import { AppState, Transaction, Account, User } from './types';
import { INITIAL_STATE, DEFAULT_SHEETS_URL, DEFAULT_ADMIN_USER } from './data/defaultState';
import { ToastContainer, ToastMessage } from './components/Toast';
import { SyncOverlay } from './components/SyncOverlay';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TransactionModal } from './components/modals/TransactionModal';
import { AccountModal } from './components/modals/AccountModal';
import { BudgetModal } from './components/modals/BudgetModal';
import { GoogleSheetsHelpModal } from './components/modals/GoogleSheetsHelpModal';
import { AdminUserModal } from './components/modals/AdminUserModal';
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { AccountsView } from './components/views/AccountsView';
import { BudgetsView } from './components/views/BudgetsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { AIView } from './components/views/AIView';
import { SettingsView } from './components/views/SettingsView';
import { uploadToSheets, downloadFromSheets } from './services/sheetsService';

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem('finanzasSZ_state_v124');
      if (saved) {
        const parsed = JSON.parse(saved);
        const usersList: User[] = Array.isArray(parsed.users) ? parsed.users : INITIAL_STATE.users;
        const hasAdmin = usersList.some(
          (u) => u.email?.toLowerCase() === DEFAULT_ADMIN_USER.email.toLowerCase() || u.role === 'admin'
        );

        return {
          ...INITIAL_STATE,
          ...parsed,
          currentUser: null, // Always show login view first when entering the application
          users: hasAdmin ? usersList : [DEFAULT_ADMIN_USER, ...usersList]
        };
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Modals
  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [accModalOpen, setAccModalOpen] = useState<boolean>(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);

  const [budgetModalOpen, setBudgetModalOpen] = useState<boolean>(false);
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string | null>(null);

  const [helpModalOpen, setHelpModalOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);

  // Save State to Local Storage
  useEffect(() => {
    try {
      localStorage.setItem('finanzasSZ_state_v124', JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }, [state]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Google Sheets Actions
  const triggerSheetsUpload = async (customState?: AppState, silent = false) => {
    const currentState = customState || state;
    if (!currentState.sheetsUrl) {
      if (!silent) showToast('Ingresa la URL de tu Google Apps Script en Ajustes', 'error');
      return;
    }

    if (!silent) {
      setIsSyncing(true);
      setSyncMessage('Subiendo datos a Google Sheets...');
    }

    try {
      await uploadToSheets(currentState.sheetsUrl, currentState);
      if (!silent) {
        showToast('¡Sincronización exitosa con Google Sheets!', 'success');
      } else {
        showToast('Guardado y sincronizado automáticamente en Google Sheets', 'success');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      if (!silent) {
        showToast(err.message || 'Error al sincronizar con Google Sheets', 'error');
      }
    } finally {
      if (!silent) {
        setIsSyncing(false);
      }
    }
  };

  const triggerSheetsDownload = async (silent = false) => {
    if (!state.sheetsUrl) {
      if (!silent) showToast('Ingresa la URL de tu Google Apps Script en Ajustes', 'error');
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Descargando datos más recientes desde Google Sheets...');

    try {
      const data = await downloadFromSheets(state.sheetsUrl);
      setState((prev) => {
        let updatedUsers = Array.isArray(data.users) && data.users.length > 0 ? data.users : prev.users;
        const hasAdmin = updatedUsers.some(
          (u) => u.email?.toLowerCase() === DEFAULT_ADMIN_USER.email.toLowerCase() || u.role === 'admin'
        );
        if (!hasAdmin) {
          updatedUsers = [DEFAULT_ADMIN_USER, ...updatedUsers];
        }

        return {
          ...prev,
          ...data,
          users: updatedUsers
        };
      });
      showToast('¡Datos descargados e integrados desde Google Sheets!', 'success');
    } catch (err: any) {
      console.error('Download error:', err);
      showToast(err.message || 'Error al descargar datos de Google Sheets', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auth Handlers
  const handleLogin = (user: User) => {
    setState((prev) => ({ ...prev, currentUser: user }));
    showToast(`Bienvenido/a, ${user.name}`, 'success');
  };

  const handleRegister = (newUser: Omit<User, 'id' | 'createdAt'>) => {
    const userObj: User = {
      ...newUser,
      id: 'user_' + Date.now(),
      createdAt: new Date().toISOString()
    };

    const nextState: AppState = {
      ...state,
      users: [...state.users, userObj]
    };

    setState(nextState);

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  const handleLogout = () => {
    setState((prev) => ({ ...prev, currentUser: null }));
    showToast('Sesión cerrada', 'info');
  };

  const handleUpdateUserStatus = (
    userId: string,
    newStatus: 'approved' | 'rejected' | 'pending'
  ) => {
    const nextState: AppState = {
      ...state,
      users: state.users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
    };

    setState(nextState);
    showToast('Estado de usuario actualizado', 'success');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  // Transaction Handlers
  const handleSaveTransaction = (txData: Partial<Transaction>) => {
    const id = txData.id || 'tx_' + Date.now();
    const existingIdx = state.transactions.findIndex((t) => t.id === id);
    const newTx: Transaction = {
      id,
      type: txData.type || 'expense',
      amount: txData.amount || 0,
      date: txData.date || new Date().toISOString(),
      account: txData.account || '',
      accountDest: txData.accountDest || null,
      category: txData.category || null,
      description: txData.description || '',
      currency: txData.currency || state.baseCurrency,
      userId: state.currentUser?.id
    };

    let updatedTxs = [...state.transactions];
    if (existingIdx >= 0) {
      updatedTxs[existingIdx] = newTx;
    } else {
      updatedTxs.push(newTx);
    }

    const nextState: AppState = {
      ...state,
      transactions: updatedTxs
    };

    setState(nextState);
    showToast('Transacción guardada con éxito', 'success');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const nextState: AppState = {
      ...state,
      transactions: state.transactions.filter((t) => t.id !== id)
    };

    setState(nextState);
    showToast('Transacción eliminada', 'info');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  // Account Handlers
  const handleSaveAccount = (accData: Partial<Account>) => {
    const id = accData.id || 'acc_' + Date.now();
    const existingIdx = state.accounts.findIndex((a) => a.id === id);
    const newAcc: Account = {
      id,
      name: accData.name || 'Nueva Cuenta',
      type: accData.type || 'bank',
      currency: accData.currency || state.baseCurrency,
      initialBalance: accData.initialBalance || 0
    };

    let updatedAccs = [...state.accounts];
    if (existingIdx >= 0) {
      updatedAccs[existingIdx] = newAcc;
    } else {
      updatedAccs.push(newAcc);
    }

    const nextState: AppState = {
      ...state,
      accounts: updatedAccs
    };

    setState(nextState);
    showToast('Cuenta guardada', 'success');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  const handleDeleteAccount = (id: string) => {
    const nextState: AppState = {
      ...state,
      accounts: state.accounts.filter((a) => a.id !== id)
    };

    setState(nextState);
    showToast('Cuenta eliminada', 'info');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  // Budget Handler
  const handleSaveBudget = (categoryId: string, limit: number) => {
    const nextState: AppState = {
      ...state,
      budgets: {
        ...state.budgets,
        [categoryId]: limit
      }
    };

    setState(nextState);
    showToast('Límite de presupuesto actualizado', 'success');

    if (nextState.autoSyncSheets && nextState.sheetsUrl) {
      triggerSheetsUpload(nextState, true);
    }
  };

  // Backup & Reset Handlers
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinanzasSZ_Backup_${Date.now()}.json`;
    a.click();
    showToast('Copia de seguridad descargada', 'success');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        setState((prev) => ({
          ...prev,
          ...imported
        }));
        showToast('Copia de seguridad restaurada correctamente', 'success');
      } catch (err) {
        showToast('El archivo JSON no es válido', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('¿Estás seguro de restablecer todos los datos locales de la aplicación?')) {
      localStorage.removeItem('finanzasSZ_state_v124');
      setState({
        ...INITIAL_STATE,
        currentUser: null
      });
      showToast('Datos restablecidos', 'info');
    }
  };

  // Render view titles
  const getViewTitles = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Resumen General',
          subtitle: 'Visión global de tus finanzas en tiempo real'
        };
      case 'transactions':
        return {
          title: 'Historial de Transacciones',
          subtitle: 'Registro completo de entradas, salidas y transferencias'
        };
      case 'accounts':
        return {
          title: 'Cuentas Financieras',
          subtitle: 'Bancos, tarjetas de crédito, efectivo e inversiones'
        };
      case 'budgets':
        return {
          title: 'Presupuestos y Límites',
          subtitle: 'Control mensual de gastos por categoría'
        };
      case 'analytics':
        return {
          title: 'Análisis Financiero',
          subtitle: 'Reportes y distribución patrimonial con gráficos'
        };
      case 'ai':
        return {
          title: 'Asistente IA con Gemini',
          subtitle: 'Diagnóstico inteligente e informes de salud financiera'
        };
      case 'settings':
        return {
          title: 'Ajustes y Datos',
          subtitle: 'Configuración regional y sincronización con Google Sheets'
        };
      default:
        return { title: 'FinanzasSZ', subtitle: 'Control Financiero' };
    }
  };

  const { title, subtitle } = getViewTitles();
  const pendingUsersCount = state.users.filter((u) => u.status === 'pending').length;

  if (!state.currentUser) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        <AuthView users={state.users} onLogin={handleLogin} onRegister={handleRegister} />
      </>
    );
  }

  return (
    <div className="h-full bg-[#F8FAFC] text-slate-800 flex flex-col md:flex-row overflow-x-hidden min-h-screen font-sans">
      <SyncOverlay isVisible={isSyncing} message={syncMessage} />
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewTransaction={() => {
          setEditingTx(null);
          setTxModalOpen(true);
        }}
        currentUser={state.currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8 space-y-6">
        <Header
          viewTitle={title}
          viewSubtitle={subtitle}
          baseCurrency={state.baseCurrency}
          currentUser={state.currentUser}
          pendingUsersCount={pendingUsersCount}
          onSync={() => triggerSheetsDownload()}
          onLogout={handleLogout}
          onOpenAdminModal={() => setAdminModalOpen(true)}
        />

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <DashboardView
            accounts={state.accounts}
            transactions={state.transactions}
            budgets={state.budgets}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
            dateFormat={state.dateFormat}
            showTime={state.showTime}
            onNavigateTab={setActiveTab}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setTxModalOpen(true);
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={state.transactions}
            accounts={state.accounts}
            users={state.users}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
            dateFormat={state.dateFormat}
            showTime={state.showTime}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setTxModalOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={state.accounts}
            transactions={state.transactions}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
            onOpenAccountModal={(acc) => {
              setEditingAcc(acc || null);
              setAccModalOpen(true);
            }}
            onDeleteAccount={handleDeleteAccount}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsView
            budgets={state.budgets}
            transactions={state.transactions}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
            onOpenBudgetModal={(catId) => {
              setSelectedBudgetCategory(catId);
              setBudgetModalOpen(true);
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            transactions={state.transactions}
            accounts={state.accounts}
            budgets={state.budgets}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
          />
        )}

        {activeTab === 'ai' && (
          <AIView
            accounts={state.accounts}
            transactions={state.transactions}
            budgets={state.budgets}
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            baseCurrency={state.baseCurrency}
            currencies={state.currencies}
            dateFormat={state.dateFormat}
            showTime={state.showTime}
            sheetsUrl={state.sheetsUrl}
            autoSyncSheets={state.autoSyncSheets}
            currentUser={state.currentUser}
            onUpdateBaseCurrency={(code) => {
              const nextState = { ...state, baseCurrency: code };
              setState(nextState);
              if (nextState.autoSyncSheets && nextState.sheetsUrl) triggerSheetsUpload(nextState, true);
            }}
            onUpdateDateFormat={(fmt) => {
              const nextState = { ...state, dateFormat: fmt };
              setState(nextState);
              if (nextState.autoSyncSheets && nextState.sheetsUrl) triggerSheetsUpload(nextState, true);
            }}
            onUpdateShowTime={(show) => {
              const nextState = { ...state, showTime: show };
              setState(nextState);
              if (nextState.autoSyncSheets && nextState.sheetsUrl) triggerSheetsUpload(nextState, true);
            }}
            onUpdateSheetsUrl={(url) => setState((prev) => ({ ...prev, sheetsUrl: url }))}
            onUpdateAutoSync={(autoSync) =>
              setState((prev) => ({ ...prev, autoSyncSheets: autoSync }))
            }
            onUploadSheets={() => triggerSheetsUpload()}
            onDownloadSheets={() => triggerSheetsDownload()}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onResetData={handleResetData}
            onOpenHelpModal={() => setHelpModalOpen(true)}
            onOpenAdminModal={() => setAdminModalOpen(true)}
          />
        )}
      </main>

      {/* Global Modals */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveTransaction}
        editingTransaction={editingTx}
        accounts={state.accounts}
        baseCurrency={state.baseCurrency}
      />

      <AccountModal
        isOpen={accModalOpen}
        onClose={() => setAccModalOpen(false)}
        onSave={handleSaveAccount}
        editingAccount={editingAcc}
        currencies={state.currencies}
      />

      <BudgetModal
        isOpen={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        categoryId={selectedBudgetCategory}
        currentLimit={
          selectedBudgetCategory ? Number(state.budgets[selectedBudgetCategory] || 0) : 0
        }
        onSave={handleSaveBudget}
        baseCurrency={state.baseCurrency}
      />

      <GoogleSheetsHelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

      <AdminUserModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        users={state.users}
        onUpdateUserStatus={handleUpdateUserStatus}
      />
    </div>
  );
}
