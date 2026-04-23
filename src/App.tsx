import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  UserProfile, 
  Material, 
  Quote, 
  CompanyInfo, 
  QuoteItem, 
  ClientInfo,
  QuoteStatus,
  UserStatus
} from './types';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  Plus, 
  LogOut, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Check,
  X,
  Download, 
  Printer, 
  FileDown, 
  ChevronRight,
  Package,
  CreditCard,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Save,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportToPDF, exportToWord, exportToExcel } from './lib/export';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }) => (
  <div className={cn("space-y-1", className)}>
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input 
      className={cn(
        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all",
        error ? "border-red-500" : "border-gray-200"
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[] }) => (
  <div className="space-y-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select 
      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null as any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ha ocurrido un error inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || '{}');
        if (parsed.error) errorMessage = `Error de base de datos: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border border-red-100">
            <AlertCircle className="mx-auto text-red-500" size={48} />
            <h2 className="text-2xl font-bold text-gray-900">Algo ha salido mal</h2>
            <p className="text-gray-600">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="w-full bg-red-600 hover:bg-red-700">
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      console.log("Current Profile:", profile.email, "Role:", profile.role, "Status:", profile.status);
    }
  }, [profile]);
  const [view, setView] = useState<'dashboard' | 'quotes' | 'materials' | 'users' | 'settings' | 'new-quote' | 'edit-quote'>('dashboard');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          console.log('User logged in:', u.email, u.uid);
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const existingProfile = userDoc.data() as UserProfile;
            // Ensure master admin always has correct role/status
            if (u.email === 'diegobarberomerino@gmail.com' && (existingProfile.role !== 'admin' || existingProfile.status !== 'approved')) {
              console.log('Master admin detected, updating role/status...');
              try {
                const updatedProfile = { ...existingProfile, role: 'admin' as const, status: 'approved' as const };
                await updateDoc(doc(db, 'users', u.uid), { role: 'admin', status: 'approved' });
                setProfile(updatedProfile);
              } catch (error) {
                console.error('Error updating master admin profile:', error);
                // Fallback: set profile locally even if updateDoc fails (might be rules issue)
                setProfile({ ...existingProfile, role: 'admin', status: 'approved' });
              }
            } else {
              setProfile(existingProfile);
            }
          } else {
            // Check if this is the master admin email
            const isMasterAdmin = u.email === 'diegobarberomerino@gmail.com';
            console.log('New user registration. Master admin:', isMasterAdmin);
            
            // New user registration
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              role: isMasterAdmin ? 'admin' : 'worker',
              status: isMasterAdmin ? 'approved' : 'pending',
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(doc(db, 'users', u.uid), newProfile);
              setProfile(newProfile);
            } catch (error) {
              console.error('Error creating new user profile:', error);
              // Fallback for master admin if setDoc fails
              if (isMasterAdmin) setProfile(newProfile);
            }
          }
        } catch (error) {
          console.error('Error in onAuthStateChanged:', error);
          // Don't throw here to avoid blocking the app
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!profile || profile.status !== 'approved' && profile.role !== 'admin') return;

    const unsubQuotes = onSnapshot(
      profile.role === 'admin' 
        ? collection(db, 'quotes') 
        : query(collection(db, 'quotes'), where('createdBy', '==', profile.uid)),
      (snap) => {
        setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'quotes')
    );

    const unsubMaterials = onSnapshot(
      collection(db, 'materials'), 
      (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'materials')
    );

    const unsubCompany = onSnapshot(
      doc(db, 'settings', 'company'), 
      (snap) => {
        if (snap.exists()) setCompanyInfo(snap.data() as CompanyInfo);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/company')
    );

    let unsubUsers: () => void = () => {};
    if (profile.role === 'admin') {
      unsubUsers = onSnapshot(
        collection(db, 'users'), 
        (snap) => {
          setUsers(snap.docs.map(d => d.data() as UserProfile));
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'users')
      );
    }

    return () => {
      unsubQuotes();
      unsubMaterials();
      unsubCompany();
      unsubUsers();
    };
  }, [profile]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-2">
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PresuBuild</h1>
          <p className="text-gray-500">Gestión profesional de presupuestos para empresas de construcción y reformas.</p>
          <Button onClick={handleLogin} className="w-full py-3 text-lg">
            Acceder con Google
          </Button>
          <p className="text-xs text-gray-400">
            Al acceder, aceptas nuestras condiciones de servicio y política de privacidad.
          </p>
        </motion.div>
      </div>
    );
  }

  if (profile?.status === 'pending' && profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <Clock className="mx-auto text-orange-500" size={48} />
          <h2 className="text-2xl font-bold text-gray-900">Acceso Pendiente</h2>
          <p className="text-gray-600">
            Tu cuenta ha sido creada correctamente. Un administrador debe aprobar tu acceso como trabajador antes de que puedas empezar a generar presupuestos.
          </p>
          <Button variant="secondary" onClick={handleLogout} className="w-full">
            Cerrar Sesión
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 text-blue-600 mb-8">
            <Building2 size={28} />
            <span className="text-xl font-bold text-gray-900">PresuBuild</span>
          </div>
          
          <nav className="space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={view === 'dashboard'} 
              onClick={() => setView('dashboard')} 
            />
            <SidebarItem 
              icon={<FileText size={20} />} 
              label="Presupuestos" 
              active={view === 'quotes'} 
              onClick={() => setView('quotes')} 
            />
            {isAdmin && (
              <>
                <SidebarItem 
                  icon={<Package size={20} />} 
                  label="Materiales" 
                  active={view === 'materials'} 
                  onClick={() => setView('materials')} 
                />
                <SidebarItem 
                  icon={<Users size={20} />} 
                  label="Trabajadores" 
                  active={view === 'users'} 
                  onClick={() => setView('users')} 
                />
                <SidebarItem 
                  icon={<Settings size={20} />} 
                  label="Configuración" 
                  active={view === 'settings'} 
                  onClick={() => setView('settings')} 
                />
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {profile?.displayName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start px-2">
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {view.replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            {view !== 'new-quote' && (
              <Button onClick={() => setView('new-quote')}>
                <Plus size={18} />
                <span>Nuevo Presupuesto</span>
              </Button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <DashboardView quotes={quotes} materials={materials} isAdmin={isAdmin} setView={setView} />}
            {view === 'quotes' && <QuotesListView quotes={quotes} isAdmin={isAdmin} onSelect={(q) => { setSelectedQuote(q); setView('edit-quote'); }} />}
            {view === 'new-quote' && <QuoteForm materials={materials} profile={profile!} onCancel={() => setView('dashboard')} onSuccess={() => setView('quotes')} />}
            {view === 'edit-quote' && selectedQuote && (
              <QuoteDetailView 
                quote={selectedQuote} 
                company={companyInfo} 
                isAdmin={isAdmin} 
                onBack={() => setView('quotes')} 
                onUpdate={async (updates) => {
                  try {
                    await updateDoc(doc(db, 'quotes', selectedQuote.id), updates);
                    setSelectedQuote({ ...selectedQuote, ...updates });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.UPDATE, `quotes/${selectedQuote.id}`);
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteDoc(doc(db, 'quotes', selectedQuote.id));
                    setView('quotes');
                    setSelectedQuote(null);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `quotes/${selectedQuote.id}`);
                  }
                }}
              />
            )}
            {view === 'materials' && isAdmin && <MaterialsView materials={materials} />}
            {view === 'users' && isAdmin && <UsersView users={users} currentUserProfile={profile!} />}
            {view === 'settings' && isAdmin && <SettingsView company={companyInfo} />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
        active 
          ? "bg-blue-50 text-blue-600" 
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DashboardView({ quotes, materials, isAdmin, setView }: { quotes: Quote[], materials: Material[], isAdmin: boolean, setView: any }) {
  const stats = useMemo(() => {
    const total = quotes.length;
    const pending = quotes.filter(q => q.status === 'pending_review').length;
    const approved = quotes.filter(q => q.status === 'approved').length;
    const revenue = quotes.filter(q => q.status === 'approved').reduce((acc, q) => acc + q.total, 0);
    return { total, pending, approved, revenue };
  }, [quotes]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Presupuestos" value={stats.total} icon={<FileText className="text-blue-600" />} />
        <StatCard title="Pendientes Revisión" value={stats.pending} icon={<Clock className="text-orange-600" />} />
        <StatCard title="Aprobados" value={stats.approved} icon={<CheckCircle className="text-green-600" />} />
        {isAdmin && <StatCard title="Facturación Aprobada" value={formatCurrency(stats.revenue)} icon={<CreditCard className="text-purple-600" />} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">Últimos Presupuestos</h3>
            <Button variant="ghost" onClick={() => setView('quotes')}>Ver todos</Button>
          </div>
          <div className="space-y-4">
            {quotes.slice(0, 5).map(quote => (
              <div key={quote.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{quote.client.name}</p>
                    <p className="text-xs text-gray-500">{quote.quoteNumber} • {formatDate(quote.date)}</p>
                  </div>
                </div>
                <StatusBadge status={quote.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickAction icon={<Plus />} label="Nuevo Presupuesto" onClick={() => setView('new-quote')} color="blue" />
            {isAdmin && (
              <>
                <QuickAction icon={<Package />} label="Gestionar Materiales" onClick={() => setView('materials')} color="orange" />
                <QuickAction icon={<Users />} label="Gestionar Equipo" onClick={() => setView('users')} color="green" />
                <QuickAction icon={<Settings />} label="Configuración" onClick={() => setView('settings')} color="gray" />
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <h4 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h4>
    </div>
  );
}

function QuickAction({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  const colors: any = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50',
    gray: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
  };

  return (
    <button 
      onClick={onClick}
      className={cn("flex flex-col items-center justify-center p-6 rounded-2xl transition-all gap-3 duration-300", colors[color])}
    >
      <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const styles: any = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pending_review: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    approved: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    sent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const labels: any = {
    draft: 'Borrador',
    pending_review: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    sent: 'Enviado',
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider", styles[status])}>
      {labels[status]}
    </span>
  );
}

// --- Quote Form (Worker Zone) ---

function QuoteForm({ materials, profile, onCancel, onSuccess }: { materials: Material[], profile: UserProfile, onCancel: () => void, onSuccess: () => void }) {
  const [client, setClient] = useState<ClientInfo>({ name: '', nif: '', address: '', phone: '', email: '' });
  const [workDescription, setWorkDescription] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [additionalCosts, setAdditionalCosts] = useState(0);
  const [taxRate, setTaxRate] = useState(21);

  const subtotal = useMemo(() => {
    const itemsTotal = items.reduce((acc, item) => acc + item.total, 0);
    return itemsTotal + laborCost + additionalCosts;
  }, [items, laborCost, additionalCosts]);

  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const addItem = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    setItems([...items, {
      materialId: material.id,
      name: material.name,
      quantity: 1,
      unitPrice: material.unitPrice,
      total: material.unitPrice
    }]);
  };

  const updateItem = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].total = quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.name || items.length === 0) return;

    const quoteNumber = `PRE-${Date.now().toString().slice(-6)}`;
    const newQuote: Omit<Quote, 'id'> = {
      quoteNumber,
      date: new Date().toISOString(),
      validityDays: 30,
      status: 'pending_review',
      client,
      workDescription,
      items,
      laborCost,
      additionalCosts,
      subtotal,
      taxRate,
      taxAmount,
      total,
      paymentMethods: ['Transferencia Bancaria'],
      conditions: 'Válido durante 30 días.',
      createdBy: profile.uid,
    };

    try {
      await addDoc(collection(db, 'quotes'), newQuote);
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotes');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden transition-colors duration-300">
      <div className="p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Crear Nuevo Presupuesto</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Introduce los datos de la obra para generar el presupuesto automáticamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        {/* Client Section */}
        <section className="space-y-4">
          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-blue-600 dark:text-blue-400" />
            Datos del Cliente
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre / Razón Social" value={client.name} onChange={e => setClient({...client, name: e.target.value})} required />
            <Input label="CIF / NIF" value={client.nif} onChange={e => setClient({...client, nif: e.target.value})} />
            <Input label="Dirección" value={client.address} onChange={e => setClient({...client, address: e.target.value})} className="md:col-span-2" />
            <Input label="Teléfono" value={client.phone} onChange={e => setClient({...client, phone: e.target.value})} />
            <Input label="Email" type="email" value={client.email} onChange={e => setClient({...client, email: e.target.value})} />
          </div>
        </section>

        {/* Work Description */}
        <section className="space-y-4">
          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-blue-600 dark:text-blue-400" />
            Descripción del Servicio
          </h4>
          <textarea 
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-32 dark:bg-gray-800 dark:text-white transition-colors"
            placeholder="Describe detalladamente el trabajo a realizar..."
            value={workDescription}
            onChange={e => setWorkDescription(e.target.value)}
            required
          />
        </section>

        {/* Materials Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package size={18} className="text-blue-600 dark:text-blue-400" />
              Materiales y Suministros
            </h4>
            <div className="flex gap-2">
              <Select 
                options={[
                  { value: '', label: 'Añadir material...' },
                  ...materials.map(m => ({ value: m.id, label: `${m.name} (${formatCurrency(m.unitPrice)}/${m.unit})` }))
                ]}
                onChange={(e) => {
                  if (e.target.value) {
                    addItem(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 py-3 text-left">Material</th>
                  <th className="px-4 py-3 text-center w-24">Cantidad</th>
                  <th className="px-4 py-3 text-right">Precio Unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, index) => (
                  <tr key={index} className="dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(index, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-center dark:bg-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 italic">No hay materiales añadidos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Costs Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-white">Otros Costes</h4>
            <Input label="Mano de Obra (€)" type="number" value={laborCost} onChange={e => setLaborCost(parseFloat(e.target.value) || 0)} />
            <Input label="Costes Adicionales (€)" type="number" value={additionalCosts} onChange={e => setAdditionalCosts(parseFloat(e.target.value) || 0)} />
            <Input label="IVA (%)" type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl space-y-3 transition-colors duration-300">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>IVA ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="pt-3 border-t border-blue-100 dark:border-blue-800 flex justify-between text-xl font-bold text-blue-900 dark:text-blue-400">
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pt-8 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={items.length === 0 || !client.name}>Generar Presupuesto</Button>
        </div>
      </form>
    </motion.div>
  );
}

// --- Quotes List ---

function QuotesListView({ quotes, isAdmin, onSelect }: { quotes: Quote[], isAdmin: boolean, onSelect: (q: Quote) => void }) {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredQuotes = quotes.filter(q => 
    q.client.name.toLowerCase().includes(search.toLowerCase()) || 
    q.quoteNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteQuote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quotes', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotes/${id}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Buscar por cliente o número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4 text-left">Número</th>
              <th className="px-6 py-4 text-left">Fecha</th>
              <th className="px-6 py-4 text-left">Cliente</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Estado</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredQuotes.map(quote => (
              <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-bold text-blue-600">{quote.quoteNumber}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(quote.date)}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{quote.client.name}</td>
                <td className="px-6 py-4 text-right font-bold">{formatCurrency(quote.total)}</td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={quote.status} />
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" onClick={() => onSelect(quote)} className="px-2">
                      <Edit size={16} />
                      <span>{isAdmin ? 'Revisar' : 'Ver'}</span>
                    </Button>
                    
                    {isAdmin && (
                      <>
                        {deletingId === quote.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDeleteQuote(quote.id)} className="text-red-600 hover:text-red-700 p-1" title="Confirmar Borrado">
                              <Check size={16} />
                            </button>
                            <button onClick={() => setDeletingId(null)} className="text-gray-400 hover:text-gray-600 p-1" title="Cancelar">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(quote.id)}
                            className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                            title="Eliminar Presupuesto"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredQuotes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No se encontraron presupuestos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// --- Quote Detail View (Admin Zone) ---

function QuoteDetailView({ quote, company, isAdmin, onBack, onUpdate, onDelete }: { quote: Quote, company: CompanyInfo | null, isAdmin: boolean, onBack: () => void, onUpdate: (updates: any) => void, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedQuote, setEditedQuote] = useState(quote);

  // Sync editedQuote with quote prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditedQuote(quote);
    }
  }, [quote, isEditing]);

  const handleStatusChange = async (status: QuoteStatus) => {
    try {
      await onUpdate({ status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotes/${quote.id}`);
    }
  };

  const handleSaveEdit = async () => {
    try {
      // Recalculate totals just in case
      const subtotal = editedQuote.items.reduce((acc, item) => acc + item.total, 0) + editedQuote.laborCost + editedQuote.additionalCosts;
      const taxAmount = subtotal * (editedQuote.taxRate / 100);
      const total = subtotal + taxAmount;
      
      const finalQuote = {
        ...editedQuote,
        subtotal,
        taxAmount,
        total,
        status: 'pending_review' // Revert to pending review if edited
      };
      
      await onUpdate(finalQuote);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotes/${quote.id}`);
    }
  };

  const handleExportPDF = () => exportToPDF('quote-printable', quote.quoteNumber);
  const handleExportWord = () => company && exportToWord(quote, company);
  const handleExportExcel = () => exportToExcel(quote);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ChevronRight className="rotate-180" size={18} />
          Volver
        </Button>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              {!isEditing && quote.status === 'pending_review' && (
                <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle size={18} />
                  Aprobar
                </Button>
              )}
              {isEditing ? (
                <Button onClick={handleSaveEdit} className="bg-blue-600">
                  <Save size={18} />
                  Guardar Cambios
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => {
                if (isEditing) {
                  setEditedQuote(quote);
                }
                setIsEditing(!isEditing);
              }}>
                {isEditing ? <X size={18} /> : <Edit size={18} />}
                {isEditing ? 'Cancelar Edición' : 'Editar'}
              </Button>
            </>
          )}
          {!isEditing && (
            <div className="relative group">
              <Button variant="primary">
                <Download size={18} />
                Exportar
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 group-hover:opacity-100 transition-all z-20">
                <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm">
                  <Printer size={16} className="text-red-500" /> PDF / Imprimir
                </button>
                <button onClick={handleExportWord} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm">
                  <FileDown size={16} className="text-blue-500" /> Word (.docx)
                </button>
                <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm">
                  <FileDown size={16} className="text-green-500" /> Excel (.xlsx)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quote Preview / Editor */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-lg p-12" id="quote-printable">
          {isEditing ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <Input label="Nombre del Cliente" value={editedQuote.client.name} onChange={e => setEditedQuote({...editedQuote, client: {...editedQuote.client, name: e.target.value}})} />
                <Input label="NIF/CIF Cliente" value={editedQuote.client.nif} onChange={e => setEditedQuote({...editedQuote, client: {...editedQuote.client, nif: e.target.value}})} />
                <Input label="Dirección Cliente" value={editedQuote.client.address} onChange={e => setEditedQuote({...editedQuote, client: {...editedQuote.client, address: e.target.value}})} />
                <Input label="Email Cliente" value={editedQuote.client.email} onChange={e => setEditedQuote({...editedQuote, client: {...editedQuote.client, email: e.target.value}})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Descripción del Trabajo</label>
                <textarea 
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32"
                  value={editedQuote.workDescription}
                  onChange={e => setEditedQuote({...editedQuote, workDescription: e.target.value})}
                />
              </div>
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 border-b pb-2">Partidas / Materiales</h4>
                {editedQuote.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-6">
                      <Input label="Descripción" value={item.name} onChange={e => {
                        const newItems = [...editedQuote.items];
                        newItems[idx].name = e.target.value;
                        setEditedQuote({...editedQuote, items: newItems});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Input label="Cant." type="number" value={item.quantity} onChange={e => {
                        const newItems = [...editedQuote.items];
                        newItems[idx].quantity = parseFloat(e.target.value) || 0;
                        newItems[idx].total = newItems[idx].quantity * newItems[idx].unitPrice;
                        setEditedQuote({...editedQuote, items: newItems});
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Input label="Precio" type="number" value={item.unitPrice} onChange={e => {
                        const newItems = [...editedQuote.items];
                        newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                        newItems[idx].total = newItems[idx].quantity * newItems[idx].unitPrice;
                        setEditedQuote({...editedQuote, items: newItems});
                      }} />
                    </div>
                    <div className="col-span-1">
                      <button 
                        onClick={() => {
                          const newItems = editedQuote.items.filter((_, i) => i !== idx);
                          setEditedQuote({...editedQuote, items: newItems});
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg mb-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setEditedQuote({...editedQuote, items: [...editedQuote.items, { name: '', quantity: 1, unitPrice: 0, total: 0 }]})}>
                  <Plus size={14} /> Añadir Partida
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-4 border-t">
                <Input label="Mano de Obra (€)" type="number" value={editedQuote.laborCost} onChange={e => setEditedQuote({...editedQuote, laborCost: parseFloat(e.target.value) || 0})} />
                <Input label="Otros Costes (€)" type="number" value={editedQuote.additionalCosts} onChange={e => setEditedQuote({...editedQuote, additionalCosts: parseFloat(e.target.value) || 0})} />
                <Input label="IVA (%)" type="number" value={editedQuote.taxRate} onChange={e => setEditedQuote({...editedQuote, taxRate: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex justify-between items-start mb-12">
                <div>
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo" className="h-16 mb-4" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4">
                      {company?.name?.[0] || 'P'}
                    </div>
                  )}
                  <h1 className="text-2xl font-bold text-gray-900">{company?.name || company?.legalName || 'Nombre Empresa'}</h1>
                  <div className="text-sm text-gray-500 space-y-1 mt-2">
                    {company?.legalName && <p className="font-medium text-gray-700">{company.legalName}</p>}
                    <p>{company?.address}</p>
                    <p>NIF: {company?.nif}</p>
                    <p>{company?.phone} • {company?.email}</p>
                    {company?.website && <p>{company.website}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-4xl font-black text-gray-100 uppercase mb-2">Presupuesto</h2>
                  <p className="text-lg font-bold text-blue-600">{quote.quoteNumber}</p>
                  <p className="text-sm text-gray-500">Fecha: {formatDate(quote.date)}</p>
                  <p className="text-sm text-gray-500">Validez: {quote.validityDays} días</p>
                </div>
              </div>

              {/* Client & Description */}
              <div className="grid grid-cols-2 gap-12 mb-12">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cliente</h4>
                  <p className="font-bold text-gray-900 text-lg">{quote.client.name}</p>
                  <div className="text-sm text-gray-600 space-y-1 mt-2">
                    <p>{quote.client.address}</p>
                    <p>NIF/CIF: {quote.client.nif}</p>
                    <p>Tel: {quote.client.phone}</p>
                    <p>{quote.client.email}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Descripción del Trabajo</h4>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.workDescription}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="py-4 text-left text-sm font-black uppercase">Descripción</th>
                    <th className="py-4 text-center text-sm font-black uppercase w-24">Cant.</th>
                    <th className="py-4 text-right text-sm font-black uppercase w-32">Precio Unit.</th>
                    <th className="py-4 text-right text-sm font-black uppercase w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-4 text-sm text-gray-700">{item.name}</td>
                      <td className="py-4 text-center text-sm text-gray-500">{item.quantity}</td>
                      <td className="py-4 text-right text-sm text-gray-500">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 text-right text-sm font-bold text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {quote.laborCost > 0 && (
                    <tr>
                      <td className="py-4 text-sm text-gray-700">Mano de Obra</td>
                      <td className="py-4 text-center text-sm text-gray-500">1</td>
                      <td className="py-4 text-right text-sm text-gray-500">{formatCurrency(quote.laborCost)}</td>
                      <td className="py-4 text-right text-sm font-bold text-gray-900">{formatCurrency(quote.laborCost)}</td>
                    </tr>
                  )}
                  {quote.additionalCosts > 0 && (
                    <tr>
                      <td className="py-4 text-sm text-gray-700">Costes Adicionales / Otros</td>
                      <td className="py-4 text-center text-sm text-gray-500">1</td>
                      <td className="py-4 text-right text-sm text-gray-500">{formatCurrency(quote.additionalCosts)}</td>
                      <td className="py-4 text-right text-sm font-bold text-gray-900">{formatCurrency(quote.additionalCosts)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-12">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>IVA ({quote.taxRate}%)</span>
                    <span>{formatCurrency(quote.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-gray-900 pt-3 border-t-2 border-gray-900">
                    <span>TOTAL</span>
                    <span>{formatCurrency(quote.total)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="grid grid-cols-2 gap-12 pt-12 border-t border-gray-100">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Métodos de Pago</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {quote.paymentMethods.map((m, i) => <li key={i} className="flex items-center gap-2"><CreditCard size={14} /> {m}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Condiciones</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{quote.conditions}</p>
                </div>
              </div>

              <div className="mt-16 flex justify-between items-end">
                <div className="w-48 border-t border-gray-300 pt-2 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Firma Empresa</p>
                </div>
                <div className="w-48 border-t border-gray-300 pt-2 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Aceptación Cliente</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h4 className="font-bold text-gray-900 mb-4">Información del Sistema</h4>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Creado por:</span>
                <span className="font-medium text-gray-900">{quote.createdBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado:</span>
                <StatusBadge status={quote.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Última actualización:</span>
                <span className="font-medium text-gray-900">{formatDate(quote.date)}</span>
              </div>
            </div>
          </div>

          {isAdmin && !isEditing && (
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
              <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                <AlertCircle size={18} />
                Zona Admin
              </h4>
              <p className="text-sm text-orange-800 mb-4">
                Como administrador, puedes modificar cualquier dato de este presupuesto antes de enviarlo definitivamente al cliente.
              </p>
              <div className="space-y-2">
                {quote.status === 'rejected' ? (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-3">
                    <p className="text-xs text-red-800 font-medium">Este presupuesto ha sido rechazado. ¿Deseas eliminarlo definitivamente?</p>
                    {isDeleting ? (
                      <div className="flex gap-2">
                        <Button variant="danger" className="flex-1 py-2 text-xs" onClick={onDelete}>
                          <Trash2 size={14} />
                          Confirmar Eliminar
                        </Button>
                        <Button variant="secondary" className="flex-1 py-2 text-xs" onClick={() => setIsDeleting(false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button variant="danger" className="w-full py-2 text-xs" onClick={() => setIsDeleting(true)}>
                        <Trash2 size={14} />
                        Eliminar de la Base de Datos
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full bg-white border-orange-200 text-orange-700 hover:bg-orange-100" onClick={() => handleStatusChange('rejected')}>
                    <XCircle size={18} />
                    Rechazar / Archivar
                  </Button>
                )}
                <Button variant="primary" className="w-full bg-blue-600" onClick={() => handleStatusChange('sent')}>
                  <Mail size={18} />
                  Marcar como Enviado
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Management Views ---

function MaterialsView({ materials }: { materials: Material[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'ud', unitPrice: 0, category: '' });
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);

  const handleAdd = async () => {
    if (!newMaterial.name || newMaterial.unitPrice <= 0) return;
    try {
      await addDoc(collection(db, 'materials'), {
        ...newMaterial,
        updatedAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewMaterial({ name: '', unit: 'ud', unitPrice: 0, category: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'materials');
    }
  };

  const handleUpdate = async () => {
    if (!editMaterial || !editMaterial.name || editMaterial.unitPrice <= 0) return;
    try {
      const { id, ...data } = editMaterial;
      await updateDoc(doc(db, 'materials', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      setEditMaterial(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `materials/${editMaterial.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materials', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `materials/${id}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Catálogo de Materiales</h3>
        <Button onClick={() => setIsAdding(true)}>
          <Plus size={18} />
          Nuevo Material
        </Button>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-blue-200 dark:border-blue-900/30 shadow-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end transition-colors duration-300">
          <Input label="Nombre" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
          <Input label="Unidad (ud, m2, ml...)" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} />
          <Input label="Precio Unitario (€)" type="number" value={newMaterial.unitPrice} onChange={e => setNewMaterial({...newMaterial, unitPrice: parseFloat(e.target.value) || 0})} />
          <div className="flex gap-2">
            <Button onClick={handleAdd} className="flex-1">Guardar</Button>
            <Button variant="secondary" onClick={() => setIsAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors duration-300">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
            <tr>
              <th className="px-6 py-4 text-left">Nombre</th>
              <th className="px-6 py-4 text-center">Unidad</th>
              <th className="px-6 py-4 text-right">Precio Unitario</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {materials.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-300">
                {editingId === m.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input 
                        className="w-full p-1 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                        value={editMaterial?.name} 
                        onChange={e => setEditMaterial({...editMaterial!, name: e.target.value})} 
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        className="w-20 p-1 border rounded text-center dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                        value={editMaterial?.unit} 
                        onChange={e => setEditMaterial({...editMaterial!, unit: e.target.value})} 
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <input 
                        className="w-24 p-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                        type="number"
                        value={editMaterial?.unitPrice} 
                        onChange={e => setEditMaterial({...editMaterial!, unitPrice: parseFloat(e.target.value) || 0})} 
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={handleUpdate} className="text-green-600 hover:text-green-700 p-1" title="Guardar">
                          <Check size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-700 p-1" title="Cancelar">
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{m.name}</td>
                    <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{m.unit}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(m.unitPrice)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        {deletingId === m.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">¿Borrar?</span>
                            <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-700" title="Confirmar Borrado">
                              <CheckCircle size={18} />
                            </button>
                            <button onClick={() => setDeletingId(null)} className="text-gray-400 hover:text-gray-500" title="Cancelar">
                              <XCircle size={18} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setEditingId(m.id);
                                setEditMaterial(m);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => setDeletingId(m.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

const OWNER_EMAIL = 'diegobarberomerino@gmail.com';

function UsersView({ users, currentUserProfile }: { users: UserProfile[], currentUserProfile: UserProfile }) {
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const isOwner = currentUserProfile.email === OWNER_EMAIL;

  const handleStatusChange = async (uid: string, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleRoleChange = async (uid: string, role: 'admin' | 'worker') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setDeletingUid(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  // The owner is invisible in the list
  const visibleUsers = users.filter(u => u.email !== OWNER_EMAIL);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gestión de Equipo</h3>
      
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors duration-300">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
            <tr>
              <th className="px-6 py-4 text-left">Usuario</th>
              <th className="px-6 py-4 text-left">Email</th>
              <th className="px-6 py-4 text-center">Rol</th>
              <th className="px-6 py-4 text-center">Estado</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleUsers.map(u => {
              const isTargetAdmin = u.role === 'admin';
              // Owner can manage everyone. Admins can only manage workers.
              const canManage = isOwner || (currentUserProfile.role === 'admin' && !isTargetAdmin);
              const canDelete = isOwner || (currentUserProfile.role === 'admin' && !isTargetAdmin);

              return (
                <tr key={u.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-300">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{u.displayName}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{u.email}</td>
                  <td className="px-6 py-4 text-center">
                    <select 
                      value={u.role} 
                      onChange={e => handleRoleChange(u.uid, e.target.value as any)}
                      className={cn(
                        "text-xs font-bold uppercase rounded px-2 py-1 outline-none transition-colors duration-300",
                        canManage ? "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer dark:text-white" : "bg-transparent border-none cursor-default dark:text-gray-400"
                      )}
                      disabled={!canManage}
                    >
                      <option value="worker">Trabajador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      u.status === 'approved' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                    )}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {canManage ? (
                        <>
                          {u.status === 'pending' ? (
                            <Button variant="ghost" className="text-green-600 dark:text-green-400 px-2" onClick={() => handleStatusChange(u.uid, 'approved')}>
                              <CheckCircle size={16} />
                              <span>Aprobar</span>
                            </Button>
                          ) : (
                            <Button variant="ghost" className="text-orange-600 dark:text-orange-400 px-2" onClick={() => handleStatusChange(u.uid, 'pending')}>
                              <XCircle size={16} />
                              <span>Suspender</span>
                            </Button>
                          )}

                          {canDelete && (
                            <>
                              {deletingUid === u.uid ? (
                                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 p-1 rounded-lg">
                                  <button onClick={() => handleDeleteUser(u.uid)} className="text-red-600 dark:text-red-400 hover:text-red-700 p-1" title="Confirmar Eliminar">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => setDeletingUid(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 p-1" title="Cancelar">
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setDeletingUid(u.uid)}
                                  className="text-gray-400 dark:text-gray-500 hover:text-red-600 p-2 transition-colors"
                                  title="Eliminar Usuario"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Solo lectura</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SettingsView({ company }: { company: CompanyInfo | null }) {
  const [info, setInfo] = useState<CompanyInfo>(company || {
    name: '',
    legalName: '',
    nif: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: ''
  });

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'settings', 'company'), info);
      alert('Configuración guardada correctamente');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/company');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('La imagen es demasiado grande. Máximo 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setInfo({ ...info, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-8">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6 transition-colors duration-300">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="text-blue-600 dark:text-blue-400" />
          Datos de la Empresa
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre Comercial" value={info.name} onChange={e => setInfo({...info, name: e.target.value})} />
          <Input label="Razón Social" value={info.legalName} onChange={e => setInfo({...info, legalName: e.target.value})} />
          <Input label="CIF / NIF" value={info.nif} onChange={e => setInfo({...info, nif: e.target.value})} />
          <Input label="Dirección" value={info.address} onChange={e => setInfo({...info, address: e.target.value})} className="md:col-span-2" />
          <Input label="Teléfono" value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} />
          <Input label="Email" value={info.email} onChange={e => setInfo({...info, email: e.target.value})} />
          <Input label="Web" value={info.website} onChange={e => setInfo({...info, website: e.target.value})} />
          
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Logo de la Empresa</label>
            <div className="flex items-center gap-4">
              {info.logoUrl ? (
                <div className="relative group">
                  <img src={info.logoUrl} alt="Logo preview" className="h-20 w-20 object-contain border dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 transition-colors" />
                  <button 
                    onClick={() => setInfo({...info, logoUrl: ''})}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 transition-colors">
                  <Building2 size={32} />
                </div>
              )}
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload}
                  className="hidden" 
                  id="logo-upload"
                />
                <label 
                  htmlFor="logo-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <Plus size={16} />
                  Subir Imagen
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 transition-colors">Formatos recomendados: PNG, JPG. Máx 1MB.</p>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full py-3">
          <Save size={18} />
          Guardar Configuración
        </Button>
      </div>
    </motion.div>
  );
}
