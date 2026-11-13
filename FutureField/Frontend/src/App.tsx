import React, { useState, useEffect, useCallback } from 'react';
import {
  Sprout, Map as MapIcon, Droplets, ThermometerSun, CloudRain,
  Activity, Settings2, ChevronRight, Info, Layers, Leaf, BarChart3,
  CalendarDays, Search, Bell, User, CloudSun, FileText, CheckCircle2,
  AlertTriangle, HelpCircle, Menu, X, ArrowUpRight, ChevronLeft,
  ArrowRight, Compass, LocateFixed, Navigation, MapPin,
  ThumbsUp, ThumbsDown, MessageSquare, Star, TrendingUp, TrendingDown, ChevronDown, CheckCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { MapContainer, TileLayer, Polygon, Rectangle, Marker, Popup, Tooltip as LeafletTooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import BangladeshMap from "./components/BangladeshMap";
import MapController from "./components/MapController";
import { bangladeshCenter } from "./data/bangladeshLocations";
import FieldDetailsModal from "./components/FieldDetailsModal";
import { FarmProvider, useFarm } from "./context/FarmContext";
import api from "./api";
import AuthPage from "./components/AuthPage";
import { useAuth } from "./context/AuthContext";
import { fieldCenter, geoJSONToVertices, polygonHectares } from "./lib/geo";
import HelpPage from "./components/HelpPage";
import SettingsPage from "./components/SettingsPage";
import FutureFieldAvatar from "./components/FutureFieldAvatar";
import { supabase } from './lib/supabase';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── API Config ───────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:8000';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPatch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function withField(path: string, fieldId?: string | null) {
  if (!fieldId || !path.startsWith('/api/')) return path;
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}field_id=${encodeURIComponent(fieldId)}`;
}

function useApiFetch<T>(path: string, deps: any[] = []) {
  const { selectedFieldId } = useFarm();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const url = withField(path, selectedFieldId);
  const load = useCallback(() => {
    if (!path) { setData(null); setLoading(false); return; }
    setLoading(true);
    apiFetch<T>(url).then(d => { setData(d); setLoading(false); }).catch(() => { setData(null); setLoading(false); });
  }, [url]);
  useEffect(() => { load(); }, [load, ...deps]);
  return { data, loading, reload: load, fieldId: selectedFieldId };
}

// Authenticated observations for the currently selected personal field.
function usePersonalNASA(enabled: boolean) {
  const { selectedFieldId } = useFarm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    if (!enabled || !selectedFieldId) { setLoading(false); return; }
    setLoading(true);
    api.getPersonalEnvironment(selectedFieldId, false)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'NASA data unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, selectedFieldId]);
  return { data, loading, error };
}

const nasaNumber = (value: unknown, digits = 1): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

// Simple full-page loading spinner
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading } = useAuth();
  // Restore the current top-level page from the URL on refresh.
  // Do not wait for an effect: the history-sync effect must see the correct
  // initial view before it can write a new browser history entry.
  const [view, setView] = useState<'landing' | 'auth' | 'demo' | 'personal'>(() => {
    const requested = new URL(window.location.href).searchParams.get('view');
    return requested === 'demo' || requested === 'auth' || requested === 'personal'
      ? requested
      : 'landing';
  });
  const [startAdd, setStartAdd] = useState(false);
  const [addAfterLogin, setAddAfterLogin] = useState(false);
  // Keep top-level views in browser history without changing authentication logic.
  const viewHistoryReady = React.useRef(false);
  const restoringView = React.useRef(false);
  useEffect(() => {
    const restore = () => {
      restoringView.current = true;
      const url = new URL(window.location.href);
      const requested = url.searchParams.get('view');
      const next = requested === 'demo' || requested === 'auth' || requested === 'personal'
        ? requested : 'landing';
      setView(next);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [user]);

  useEffect(() => {
    if (!viewHistoryReady.current) {
      viewHistoryReady.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if ((url.searchParams.get('view') || 'landing') === view) { restoringView.current = false; return; }
    if (restoringView.current) { restoringView.current = false; return; }
    if (view === 'landing') {
      url.searchParams.delete('view');
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('view', view);
      url.searchParams.delete('tab');
    }
    window.history.pushState({ futureField: true }, '', url);
  }, [view]);


  useEffect(() => {
    if (loading) return;
    if (user && view === 'auth') {
      setStartAdd(addAfterLogin);
      setAddAfterLogin(false);
      setView('personal');
    }
  }, [user, loading, view, addAfterLogin]);

  if (loading) {
    return <div className="min-h-screen bg-[#f7f5f0] flex items-center justify-center text-[#174D3B]">Loading FutureField...</div>;
  }

  if (view === 'landing') {
    return (
      <LandingPage
        onEnter={() => { setStartAdd(false); setView('demo'); }}
        onLogin={() => { setAddAfterLogin(false); setView(user ? 'personal' : 'auth'); }}
        onAddField={() => {
          if (user) { setStartAdd(true); setView('personal'); }
          else { setAddAfterLogin(true); setView('auth'); }
        }}
      />
    );
  }

  if (view === 'auth') {
    return <AuthPage onBack={() => { setAddAfterLogin(false); setView('landing'); }} />;
  }

  if (view === 'personal' && !user) {
    return <AuthPage onBack={() => setView('landing')} />;
  }

  return (
    <FarmProvider
      key={`${view}-${user?.id ?? "guest"}`}
      preferAdd={startAdd}
      isDemo={view === "demo"}
    >
      <Application
        startAdd={startAdd}
        isDemo={view === 'demo'}
        onExit={() => { setStartAdd(false); setView('landing'); }}
      />
    </FarmProvider>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onEnter, onAddField, onLogin }: { onEnter: () => void; onAddField: () => void; onLogin: () => void }) {
  const howItWorksRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
            <Sprout className="text-primary-foreground w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-xl leading-tight">FutureField</h1>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">From Earth Observation to Better Farm Decisions</p>
          </div>
        </div>
        <button onClick={onLogin} className="text-sm font-medium text-muted-foreground hover:text-foreground">Login</button>
      </nav>

      <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full p-6 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div className="space-y-8">
            <h2 className="font-display text-4xl lg:text-6xl font-bold leading-tight text-foreground">
              Make smarter farm plans for a changing climate.
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Understand your field, explore crop options, and compare rotation scenarios using Earth observation data and your farm information.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={onLogin} className="bg-primary text-primary-foreground font-semibold text-lg py-4 px-8 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center shadow-lg">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
            <div>
              <button type="button" onClick={() => howItWorksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                How FutureField Works <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square lg:aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative border-4 border-card">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&auto=format&fit=crop&q=80')] bg-cover bg-center saturate-75"></div>

            </div>
          </div>
        </div>

        <div ref={howItWorksRef} className="mt-24 mb-12">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-8">How it works</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 overflow-x-auto pb-4">
            <FlowStep icon={<Layers/>} label="NASA Earth Data" desc="Satellites observe" />
            <ChevronRight className="w-5 h-5 text-muted-foreground hidden md:block shrink-0" />
            <FlowStep icon={<Activity/>} label="Field Intelligence" desc="Condition analysis" />
            <ChevronRight className="w-5 h-5 text-muted-foreground hidden md:block shrink-0" />
            <FlowStep icon={<Leaf/>} label="Crop Suitability" desc="Identify matches" />
            <ChevronRight className="w-5 h-5 text-muted-foreground hidden md:block shrink-0" />
            <FlowStep icon={<Settings2/>} label="Rotation Planner" desc="Build rotations" />
            <ChevronRight className="w-5 h-5 text-muted-foreground hidden md:block shrink-0" />
            <FlowStep icon={<ThermometerSun/>} label="What-If Scenarios" desc="Stress test plans" />
          </div>
        </div>
      </main>
    </div>
  );
}

function FlowStep({ icon, label, desc }: any) {
  return (
    <div className="flex flex-col items-center text-center w-36 shrink-0">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3 text-primary border border-border">{icon}</div>
      <div className="font-semibold text-sm mb-1">{label}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

// Styled field picker; selection still uses the existing FarmContext setter.
function FieldSelector({ fields, selectedFieldId, onSelect }: {
  fields: { id: string; name: string }[];
  selectedFieldId: string | null | undefined;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = fields.find(field => field.id === selectedFieldId);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-label="Select field"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={fields.length === 0}
        onClick={() => setOpen(previous => !previous)}
        className={`group flex max-w-[240px] items-center gap-2 rounded-lg border bg-[#f8faf7] px-3 py-2 text-sm font-medium text-[#1a3f31] shadow-sm outline-none transition-all hover:border-[#8eafa0] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#174D3B]/30 disabled:cursor-not-allowed disabled:opacity-60 ${open ? 'border-[#7ca18f] bg-white ring-2 ring-[#174D3B]/10' : 'border-[#dce6df]'}`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e6f0e9] text-[#174D3B]">
          <Sprout className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate text-left">{selected?.name || (fields.length ? 'Select a field' : 'No fields yet')}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#537465] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[200] w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#dce6df] bg-white p-1.5 shadow-[0_16px_40px_rgba(16,45,31,0.17)]" role="listbox" aria-label="Your fields">
          <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#81938a]">Select your field</div>
          <div className="max-h-64 overflow-y-auto">
            {fields.map(field => {
              const active = field.id === selectedFieldId;
              return (
                <button
                  key={field.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onSelect(field.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174D3B]/30 ${active ? 'bg-[#e9f3ed] font-semibold text-[#174D3B]' : 'text-[#33483d] hover:bg-[#f3f7f3]'}`}
                >
                  <Sprout className={`h-4 w-4 shrink-0 ${active ? 'text-[#174D3B]' : 'text-[#8aa89a]'}`} />
                  <span className="min-w-0 flex-1 truncate">{field.name}</span>
                  {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#174D3B]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Application Shell ──────────────────────────────────────────────────────
function Application({ startAdd, isDemo, onExit }: { startAdd?: boolean; isDemo: boolean; onExit: () => void }) {
  const farm = useFarm();
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState('');
  const handleExit = async () => {
    if (isDemo) { onExit(); return; }
    try { await signOut(); onExit(); }
    catch (error) { setSignOutError(error instanceof Error ? error.message : 'Could not sign out'); }
  };
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  // The tab is reflected in the URL so desktop Back/Forward and mobile
  // browser gestures restore the page the visitor was actually viewing.
  const tabHistoryReady = React.useRef(false);
  const restoringTab = React.useRef(false);
  const validTabs = React.useMemo(() => new Set([
    'Dashboard', 'My Fields', 'Crop Analysis', 'Rotation Planner',
    'Climate Insights', 'Scenario Lab', 'Data Explorer', 'Reports',
    'Season Outcomes', 'Alerts', 'Help', 'Profile', 'Field Intelligence',
  ]), []);
  useEffect(() => {
    const requested = new URL(window.location.href).searchParams.get('tab');
    if (requested && validTabs.has(requested)) {
      restoringTab.current = true;
      setActiveTab(requested);
    }
    const restore = () => {
      const requestedTab = new URL(window.location.href).searchParams.get('tab');
      restoringTab.current = true;
      setActiveTab(requestedTab && validTabs.has(requestedTab) ? requestedTab : 'Dashboard');
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [validTabs]);
  useEffect(() => {
    if (!tabHistoryReady.current) {
      tabHistoryReady.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if ((url.searchParams.get('tab') || 'Dashboard') === activeTab) { restoringTab.current = false; return; }
    if (restoringTab.current) { restoringTab.current = false; return; }
    if (activeTab === 'Dashboard') url.searchParams.delete('tab');
    else url.searchParams.set('tab', activeTab);
    window.history.pushState({ futureField: true }, '', url);
  }, [activeTab]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerDraw, setTriggerDraw] = useState(false);
  const [askText, setAskText] = useState('');
  const [askHistory, setAskHistory] = useState<{ q: string; a: string; sources: string[] }[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const sendAssistantMessage = async () => {
    const question = askText.trim();
    if (!question || asking) return;
    setAsking(true);
    setAskError('');
    try {
      let res: { answer: string; sources?: string[] };
      if (isDemo) {
        // Demo is explicitly separate from authenticated personal field data.
        res = await api.askAssistant(question, farm.selectedFieldId);
      } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.access_token) throw new Error('Please sign in again to use Ask FutureField.');
        const response = await fetch(`${BASE_URL}/api/assistant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ question, field_id: farm.selectedFieldId || null, history: askHistory.slice(-12) }),
        });
        if (!response.ok) {
          if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
          if (response.status === 404) throw new Error('Selected field was not found. Please select another field.');
          if (response.status === 503) throw new Error('AI assistant is temporarily unavailable or its quota was reached.');
          throw new Error('Assistant is unavailable right now. Please try again.');
        }
        res = await response.json();
      }
      setAskHistory(history => [...history, { q: question, a: res.answer, sources: res.sources || [] }]);
      setAskText('');
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'Could not send message.');
    } finally {
      setAsking(false);
    }
  };

  const navItems = [
    { id: 'Dashboard', icon: <MapIcon className="w-4 h-4" />, label: 'Dashboard' },
    { id: 'My Fields', icon: <Layers className="w-4 h-4" />, label: 'My Fields' },
    { id: 'Crop Analysis', icon: <Sprout className="w-4 h-4" />, label: 'Crop Analysis' },
    { id: 'Rotation Planner', icon: <Settings2 className="w-4 h-4" />, label: 'Rotation Planner' },
    { id: 'Climate Insights', icon: <CloudSun className="w-4 h-4" />, label: 'Climate Insights' },
    { id: 'Scenario Lab', icon: <Activity className="w-4 h-4" />, label: 'Simulations' },
    { id: 'Data Explorer', icon: <BarChart3 className="w-4 h-4" />, label: 'Data Explorer' },
    { id: 'Reports', icon: <FileText className="w-4 h-4" />, label: 'Reports' },
    { id: 'Season Outcomes', icon: <CheckCircle className="w-4 h-4" />, label: 'Season Outcomes' },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <aside className="w-64 border-r border-border bg-[#1a231f] flex-col hidden md:flex text-slate-300">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Sprout className="text-primary-foreground w-5 h-5" />
            </div>
            <h1 className="font-display font-semibold text-lg leading-tight tracking-tight text-white">FutureField</h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
            />
          ))}
          <div className="my-4 border-t border-white/10 pt-4"></div>
          <NavItem icon={<AlertTriangle className="w-4 h-4" />} label="Alerts" active={activeTab === 'Alerts'} onClick={() => setActiveTab('Alerts')} />
          <NavItem
  icon={<HelpCircle className="w-4 h-4" />}
  label="Help"
  active={activeTab === "Help"}
  onClick={() => setActiveTab("Help")}
/>
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-2 text-xs text-slate-400 break-words">{isDemo ? 'Demo mode' : (user?.email ?? 'Signed in')}</div>
          <NavItem icon={<User className="w-4 h-4" />} label={isDemo ? 'Exit Demo' : 'Sign Out'} active={false} onClick={() => { void handleExit(); }} />
          {signOutError && <p className="px-3 text-xs text-red-300">{signOutError}</p>}
          <NavItem icon={<Settings2 className="w-4 h-4" />} label="Profile" active={activeTab === "Profile"} onClick={() => setActiveTab("Profile")} />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f7f5f0]">

        <header className="flex flex-nowrap items-center justify-between gap-2 px-2 sm:px-4 py-3 border-b border-border bg-card shadow-sm z-10">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <button aria-label="Open navigation menu" className="md:hidden shrink-0 p-1.5 text-muted-foreground hover:bg-muted rounded" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex shrink-0 items-center gap-1 text-[#174D3B]" aria-label="FutureField">
              <Sprout className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-tight min-[390px]:text-sm">FutureField</span>
            </div>
            <div className="md:hidden min-w-0 shrink-0 max-w-[130px] [&_button]:!w-auto [&_button]:!max-w-[130px] [&_button]:!gap-1 [&_button]:!px-2 [&_button]:!py-1.5 [&_button>span:first-child]:hidden">
              <FieldSelector
                fields={farm.fields}
                selectedFieldId={farm.selectedFieldId}
                onSelect={farm.setSelectedFieldId}
              />
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="font-display font-semibold text-foreground">{farm.farmName}</div>
              <span className="text-muted-foreground text-xs font-bold px-1.5">•</span>
              <FieldSelector
                fields={farm.fields}
                selectedFieldId={farm.selectedFieldId}
                onSelect={farm.setSelectedFieldId}
              />
            </div>
          </div>
          <div className="flex shrink-0 min-w-0 items-center justify-end gap-3">
            <div className="hidden xl:flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="whitespace-nowrap">{isDemo ? 'Demo farm' : (farm.lastUpdated || 'NASA observations')}</span>
              <span className="bg-muted px-2 py-1 rounded whitespace-nowrap">Field-specific analysis</span>
            </div>
          <button
  type="button"
  aria-label="Open profile"
  title="View Profile"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTab("Profile");
    setMobileMenuOpen(false);
  }}
  className="relative z-20 flex items-center justify-center rounded-full cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#174D3B]"
>
  <FutureFieldAvatar isDemo={isDemo} size={34} />
</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'Dashboard' && <Dashboard isDemo={isDemo} startAdd={startAdd || triggerDraw} onOpenDetails={() => { setDetailsOpen(true); setTriggerDraw(false); }} onNavigate={setActiveTab} />}
          {activeTab === 'Rotation Planner' && (isDemo ? <RotationPlanner /> : <PersonalRotationPlanner />)}
          {activeTab === 'Scenario Lab' && <ScenarioLab isDemo={isDemo} />}
          {activeTab === 'My Fields' && <MyFields isDemo={isDemo} onNavigate={setActiveTab} onAdd={() => { setTriggerDraw(true); setActiveTab('Dashboard'); }} />}
          {activeTab === 'Field Intelligence' && <FieldIntelligence isDemo={isDemo} onNavigate={setActiveTab} />}
          {activeTab === 'Crop Analysis' && <CropAnalysis onNavigate={setActiveTab} isDemo={isDemo} />}
          {activeTab === 'Climate Insights' && <ClimateInsights isDemo={isDemo} />}
          {activeTab === 'Data Explorer' && <DataExplorer isDemo={isDemo} />}
          {activeTab === 'Reports' && <Reports isDemo={isDemo} onNavigate={setActiveTab} />}
          {activeTab === 'Season Outcomes' && <SeasonOutcomes />}
          {activeTab === 'Alerts' && <Alerts onNavigate={setActiveTab} />}
          {activeTab === 'Help' && <HelpPage />}
          {activeTab === 'Profile' && <SettingsPage isDemo={isDemo} onSignOut={handleExit} />}
        </div>

        {/* Ask FutureField Button */}
        <button onClick={() => setAiOpen(true)} className="absolute bottom-6 right-6 bg-primary text-primary-foreground shadow-lg rounded-full px-4 py-3 flex items-center gap-2 font-medium hover:bg-primary/90 transition-all z-[100] hover:-translate-y-1 duration-200">
          <Sprout className="w-5 h-5" /> Ask FutureField
        </button>

        {aiOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 z-[998] md:hidden" onClick={() => setAiOpen(false)}></div>
            <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-card border-l border-border shadow-2xl z-[999] flex flex-col">
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2"><Sprout className="w-5 h-5 text-primary"/> FutureField Assistant</h3>
                  <button onClick={() => setAiOpen(false)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5"/></button>
                </div>
                <p className="text-sm text-muted-foreground">Answers use the selected field and NASA observations.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-3">Suggested</div>
                  <div className="flex flex-wrap gap-2">
                    {['How is my field?', 'What is my NDVI?', 'How much rainfall?', 'Should I irrigate?'].map(q => (
                      <button key={q} onClick={() => setAskText(q)} className="bg-muted text-muted-foreground hover:text-foreground text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:border-primary/30 transition-colors text-left">{q}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {askHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground">Ask about the selected field, crop scores, or rotation scenarios.</p>
                  )}
                  {askHistory.map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex flex-col items-end gap-1">
                        <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[85%]">{item.q}</div>
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <div className="bg-muted/50 border border-border text-foreground px-4 py-3 rounded-2xl rounded-tl-sm text-sm max-w-[90%] leading-relaxed">
                          {item.a}
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">Sources Used</div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.sources.map(s => (
                                <span key={s} className="bg-background text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded border border-border">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-border bg-card">
                <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-all">
                  <input value={askText} onChange={e => setAskText(e.target.value)} type="text" placeholder="Ask FutureField..." className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void sendAssistantMessage(); }
                    }} />
                   <button type="button" disabled={asking || !askText.trim()} onClick={() => { void sendAssistantMessage(); }} className="text-primary hover:text-primary/80 disabled:opacity-40" aria-label="Send message"><ArrowUpRight className="w-5 h-5"/></button>
                </div>
                {askError && <p role="alert" className="text-xs text-red-600 mt-2">{askError}</p>}
                {asking && <p className="text-xs text-muted-foreground mt-2">Thinking…</p>}
                <p className="text-[9px] text-muted-foreground text-center mt-3">FutureField provides decision support and does not replace local agronomic advice.</p>
              </div>
            </div>
          </>
        )}
      </main>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden flex">
          <div className="w-64 bg-[#1a231f] h-full flex flex-col shadow-xl">
            <div className="p-4 flex justify-end">
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/70 hover:text-white p-2"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
              {navItems.map(item => (
  <NavItem
    key={item.id}
    icon={item.icon}
    label={item.label}
    active={activeTab === item.id}
    onClick={() => {
      setActiveTab(item.id);
      setMobileMenuOpen(false);
    }}
  />
))}

<NavItem
  icon={<AlertTriangle className="w-4 h-4" />}
  label="Alerts"
  active={activeTab === "Alerts"}
  onClick={() => {
    setActiveTab("Alerts");
    setMobileMenuOpen(false);
  }}
/>

<NavItem
  icon={<HelpCircle className="w-4 h-4" />}
  label="Help"
  active={activeTab === "Help"}
  onClick={() => {
    setActiveTab("Help");
    setMobileMenuOpen(false);
  }}
/>
              <div className="mt-4 border-t border-white/10 pt-4">
                <NavItem icon={<User className="w-4 h-4" />} label={isDemo ? 'Exit Demo' : 'Sign Out'} active={false} onClick={() => { setMobileMenuOpen(false); void handleExit(); }} />
                {signOutError && <p className="px-3 text-xs text-red-300">{signOutError}</p>}
                <NavItem icon={<Settings2 className="w-4 h-4" />} label="Profile" active={activeTab === "Profile"} onClick={() => { setActiveTab("Profile"); setMobileMenuOpen(false); }} />
              </div>
            </nav>
          </div>
        </div>
      )}
      <FieldDetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} onSaved={(id) => { farm.setSelectedFieldId(id); setActiveTab('Field Intelligence'); }} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-primary/20 text-white border border-primary/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
      {icon}{label}
    </button>
  );
}

// ─── Page 02: Dashboard ───────────────────────────────────────────────────────
function Dashboard({ isDemo, startAdd, onOpenDetails, onNavigate }: { isDemo: boolean; startAdd?: boolean; onOpenDetails: () => void; onNavigate: (tab: string) => void }) {
  const farm = useFarm();
  const demo = useApiFetch<any>(isDemo ? '/api/dashboard' : '');
  const personal = usePersonalNASA(!isDemo);
  const sharedResponse = useSharedFieldMetrics(farm.selectedFieldId, !isDemo);
  const sharedMetrics = sharedResponse.data?.metrics;
  const loading = isDemo ? demo.loading : personal.loading;
  const data = isDemo ? demo.data : null;
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const mapCenter: [number, number] = farm.selectedField ? fieldCenter(farm.selectedField) : bangladeshCenter;
  const [districtCoordinates, setDistrictCoordinates] = useState<[number, number] | null>(null);
  const [drawing, setDrawing] = useState(!!startAdd);
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [locationError, setLocationError] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const areaHa = vertices.length >= 3 ? polygonHectares(vertices) : 0;


  React.useEffect(() => {
    if (startAdd) { setDrawing(true); setVertices([]); }
  }, [startAdd]);

  const saveField = () => {
    if (vertices.length < 3) return;
    farm.setPendingBoundary({ vertices: [...vertices], division: selectedDivision, district: selectedDistrict, areaHa });
    setDrawing(false);
    onOpenDetails();
  };

  const chooseDistrict = async (division:string, district:string) => {
    setSelectedDivision(division); setSelectedDistrict(district);
    setDistrictCoordinates(null); setLocationError(''); setVertices([]); setDrawing(false);
    if (!district) return;
    try {
      const query = encodeURIComponent(`${district}, ${division}, Bangladesh`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=bd&q=${query}`);
      if (!response.ok) throw new Error('Geocoding unavailable');
      const results: Array<{lat:string;lon:string;display_name:string}> = await response.json();
      const hit = results.find(item => item.display_name.toLowerCase().includes('bangladesh'));
      if (!hit) throw new Error('District not found');
      setDistrictCoordinates([Number(hit.lat), Number(hit.lon)]);
    } catch { setLocationError('Could not locate this district. Please try again or pan the map manually.'); }
  };

  const d = data || {};
  const ind = personal.data?.indicators || {};
  const fi = isDemo ? (d.field_intelligence || {}) : {
    field_name: farm.selectedField?.name,
    area_ha: farm.selectedField?.area_ha,
    current_crop: farm.selectedField?.current_crop || farm.selectedField?.crop,
    health_score: '—',
    health_label: personal.loading ? 'Loading observations…' : personal.error ? 'NASA data unavailable' : personal.data ? 'Environmental observations' : 'Select a field',
    soil_moisture: typeof ind.soil_moisture_latest_pct === 'number' ? `${nasaNumber(ind.soil_moisture_latest_pct)}% root wetness` : '—',
    rainfall: typeof ind.rain_total_mm === 'number' ? `${nasaNumber(ind.rain_total_mm)} mm (${personal.data?.start} to ${personal.data?.end})` : '—',
    ndvi: nasaNumber(ind.ndvi_latest, 3),
    temperature: typeof ind.mean_temp_c === 'number' ? `${nasaNumber(ind.mean_temp_c, 2)}°C` : '—',
    et: personalETLabel(personal.data),
    water_stress: sharedMetrics?.water_stress || 'Not assessed',
  };
  const envCards = isDemo ? (d.env_cards || []) : personal.data ? [
    { title: 'Rainfall', value: `${nasaNumber(ind.rain_total_mm)} mm`, context: `Total for ${personal.data.start} to ${personal.data.end}` },
    { title: 'NDVI', value: nasaNumber(ind.ndvi_mean, 3), context: 'Mean vegetation index' },
    { title: 'Temperature', value: `${nasaNumber(ind.mean_temp_c, 2)}°C`, context: 'Mean air temperature' },
    { title: 'Data source', value: personal.data.source, context: (personal.data.sources || []).join(', ') },
  ] : [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <header className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-1">{loading ? 'Loading NASA observations…' : (isDemo ? (d.greeting || 'Welcome') : 'Your Farm Overview')}</h2>
          <p className="text-muted-foreground text-lg">Current condition of {farm.selectedField?.name || 'your farm'} from NASA POWER and MODIS.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <TopMetric label={`${isDemo ? (d.active_fields ?? farm.fields.length) : farm.fields.length} Active Fields`} />
          <TopMetric label={`${isDemo ? (d.total_area_ha ?? 0) : farm.fields.reduce((sum, f) => sum + (f.area_ha || 0), 0).toFixed(2)} ha Total Area`} />
          <TopMetric label={isDemo ? `${d.soil_moisture_pct ?? '—'}% Soil Moisture` : `${nasaNumber(ind.soil_moisture_latest_pct)}% Root Wetness`} />
          <TopMetric label={isDemo ? `${d.water_stress ?? '—'} Water Stress` : `Water Stress: ${sharedMetrics?.water_stress || 'Not assessed'}${sharedMetrics?.water_stress_assessment?.status === 'indicative' ? ' (indicative)' : ''}`} highlight />
          {!isDemo && <TopMetric label={`ET: ${personalETLabel(personal.data)}`} />}
          <TopMetric label={isDemo ? (d.season ?? 'Current Growing Season') : (personal.data ? `NASA: ${personal.data.source}` : 'NASA: pending')} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-auto lg:h-[600px]">
        <div className="lg:col-span-3 min-w-0 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden relative">
          <div className="w-full h-[420px] shrink-0 lg:h-auto lg:flex-1 relative z-0">
            <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto z-[1000] w-auto sm:w-[320px] sm:max-w-[calc(100%-2rem)]">
              <BangladeshMap onDistrictChange={chooseDistrict} />
            </div>
            <MapContainer center={mapCenter} zoom={farm.selectedField ? 14 : 7} zoomControl={false} className="h-full w-full" key={farm.selectedFieldId || 'bd'}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
              <MapController coordinates={districtCoordinates} selectedPoint={selectedPoint} onPointSelect={setSelectedPoint} drawing={drawing} vertices={vertices} onVertexAdd={(point) => setVertices(previous => [...previous, point])} />
              {vertices.length >= 2 && <Polygon positions={vertices} pathOptions={{color:'#174D3B',weight:3,fillOpacity:0.25}} />}
              {farm.fields.map((field) => {
                const pts = geoJSONToVertices(field.boundary);
                return pts.length >= 3 ? <Polygon key={field.id} positions={pts} pathOptions={{color: field.id === farm.selectedFieldId ? '#174D3B' : '#16a34a', weight: field.id === farm.selectedFieldId ? 4 : 2, fillOpacity: 0.2}}><LeafletTooltip>{field.name}</LeafletTooltip></Polygon> : null;
              })}
              <MapControls />
            </MapContainer>
          </div>

          <div className="absolute top-4 right-4 z-[400] hidden lg:flex gap-2">
            <div className="bg-card/95 backdrop-blur p-2 rounded shadow border border-border flex items-center gap-2">
              <select className="bg-transparent text-sm font-medium outline-none">
                <option>Soil Moisture</option><option>Rainfall</option><option>Vegetation Health (NDVI)</option><option>Drought Risk</option>
              </select>
              <div className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{isDemo ? 'Demo layer' : 'Map only · no NASA raster'}</div>
            </div>
          </div>

          <div className="relative z-[800] m-3 w-auto rounded-lg border border-border bg-white/95 p-3 shadow-lg text-sm space-y-2 lg:absolute lg:bottom-4 lg:left-14 lg:m-0 lg:max-w-[calc(100%-5rem)]">
            <div className="font-semibold text-[#174D3B]">Field Boundary</div>
            {locationError && <p className="text-red-600 text-xs">{locationError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded bg-[#174D3B] px-3 py-1.5 text-white" onClick={() => {setDrawing(true);setVertices([]);}}>Draw field</button>
              <button type="button" className="rounded border px-3 py-1.5" onClick={() => setVertices(v => v.slice(0,-1))} disabled={!vertices.length}>Undo</button>
              <button type="button" className="rounded border px-3 py-1.5" onClick={() => {setDrawing(false);setVertices([]);}}>Cancel</button>
            </div>
            {drawing && <p className="text-xs">Click 3 or more corners on the map. {vertices.length} points selected.</p>}
            {vertices.length >= 3 && <div>Estimated area: <b>{areaHa.toFixed(3)} ha</b> ({(areaHa*2.47105).toFixed(3)} acres)</div>}
            {vertices.length >= 3 && <button type="button" onClick={saveField} className="rounded bg-[#174D3B] text-white px-3 py-1">Continue to field details</button>}
            <p className="text-xs text-gray-500">{farm.fields.length} fields stored on the server. NASA data loads after save.</p>
          </div>

          <div className="absolute top-1/2 left-4 -translate-y-1/2 z-[400] hidden lg:flex flex-col gap-2">
            <button className="bg-card/95 backdrop-blur p-2 rounded shadow border border-border hover:bg-muted text-foreground"><Search className="w-4 h-4" /></button>
            <button className="bg-card/95 backdrop-blur p-2 rounded shadow border border-border hover:bg-muted text-foreground"><LocateFixed className="w-4 h-4" /></button>
            <button className="bg-card/95 backdrop-blur p-2 rounded shadow border border-border hover:bg-muted text-foreground"><Layers className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Field Intelligence Panel */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col h-full overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Field Intelligence</h3>
              <h4 className="font-display text-2xl font-semibold mt-1">{fi.field_name || farm.selectedField?.name || 'Select a field'}</h4>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">{fi.area_ha ?? farm.selectedField?.area_ha ?? '—'} ha</span>
              <div className="text-xs text-muted-foreground mt-1">{fi.current_crop || farm.selectedField?.crop || '—'}</div>
            </div>
          </div>
          <div className="mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                <span className="text-accent font-bold text-xl">{fi.health_score ?? '—'}</span>
              </div>
              <div>
                <div className="font-semibold text-foreground">{fi.health_label || 'Awaiting NASA data'}</div>
                <div className="text-xs text-muted-foreground mt-1">Status index</div>
              </div>
            </div>
          </div>
          <div className="space-y-4 mb-8 flex-1">
            <MetricRow label="Soil Moisture" value={fi.soil_moisture || '—'} />
            <MetricRow label="Rainfall" value={fi.rainfall || '—'} />
            <MetricRow label="NDVI" value={fi.ndvi || '—'} />
            <MetricRow label="Temperature" value={fi.temperature || '—'} />
            <MetricRow label="ET" value={fi.et || '—'} />
            <MetricRow label="Water Stress" value={fi.water_stress || '—'} highlight />
          </div>
          <div className="space-y-3 mt-auto">
            <button onClick={() => onNavigate('Field Intelligence')} className="w-full bg-card text-foreground font-medium py-2.5 rounded-md hover:bg-muted transition-colors border border-border text-sm shadow-sm flex items-center justify-center gap-2">
              <Info className="w-4 h-4"/> Open Field Intelligence
            </button>
            <button onClick={() => onNavigate('Rotation Planner')} className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-md hover:bg-primary/90 transition-colors shadow">
              Plan Next Crop
            </button>
            <button onClick={() => onNavigate('Data Explorer')} className="w-full bg-transparent text-primary font-medium py-2 rounded-md hover:underline transition-colors text-sm">View History</button>
          </div>
        </div>
      </div>

      {!isDemo && personal.error && <p role="alert" className="text-sm text-red-700">Could not load personal NASA data: {personal.error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {envCards.map((c: any) => (
          <EnvCard key={c.title} title={c.title} value={c.value} context={c.context} type={c.title === 'Soil Moisture' || c.title === 'Rainfall' ? 'sparkline' : undefined} />
        ))}
      </div>
    </div>
  );
}

function TopMetric({ label, highlight = false }: { label: string, highlight?: boolean }) {
  return (
    <div className={`px-3 py-1.5 rounded-md text-xs border ${highlight ? 'bg-accent/10 border-accent/20 text-accent-foreground font-semibold' : 'bg-card border-border text-muted-foreground'}`}>{label}</div>
  );
}
function MetricRow({ label, value, highlight = false }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${highlight ? 'text-accent' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
function EnvCard({ title, value, context, type }: any) {
  const data = Array.from({length: 10}).map((_,i) => ({v: 20 + i*0.8 + Math.sin(i)*3}));
  return (
    <div className="bg-card border border-border p-5 rounded-xl shadow-sm cursor-pointer hover:border-primary/30 hover:shadow transition-all group">
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">{title}</h4>
      <div className="text-2xl font-display font-semibold mb-2 group-hover:text-primary transition-colors">{value}</div>
      <p className="text-xs text-muted-foreground mb-3">{context}</p>
      {type === 'sparkline' && (
        <div className="h-8 w-full opacity-60 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}><Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={false} /></LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
function MapControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
      <div className="bg-card/95 backdrop-blur rounded shadow border border-border flex flex-col">
        <button onClick={() => map.zoomIn()} className="p-2 border-b border-border hover:bg-muted text-foreground">+</button>
        <button onClick={() => map.zoomOut()} className="p-2 hover:bg-muted text-foreground">-</button>
      </div>
    </div>
  );
}

// ─── Page 03: My Fields ───────────────────────────────────────────────────────
function MyFields({ onNavigate, onAdd, isDemo }: { onNavigate: (tab: string) => void; onAdd: () => void; isDemo: boolean }) {
  const farm = useFarm();
  const loading = farm.loading;
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const deletePersonalField = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    setActionError('');
    setDeletingId(id);
    try {
      await api.deleteField(id);
      await farm.refreshFields();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete field.');
    } finally {
      setDeletingId(null);
    }
  };

  // FarmContext separates authenticated personal fields from demo fields.
  const allFields = farm.fields;

  const filteredFields = allFields.filter((f: any) => {
    if (filter !== 'All' && f.stress !== filter && f.condition !== filter) return false;
    if (search && !f.name?.toLowerCase().includes(search.toLowerCase()) && !(f.crop || f.current_crop || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-1">My Fields</h2>
          <p className="text-muted-foreground text-lg">Monitor your fields and see what is changing.</p>
        </div>
        <button onClick={onAdd} className="bg-primary text-primary-foreground font-semibold py-2.5 px-6 rounded-lg hover:bg-primary/90 transition-colors shadow-sm">+ Add Field</button>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search fields or crops..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          {['All','High','Moderate','Low'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {f === 'All' ? 'All Fields' : `${f} Stress`}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {editingId && (
        <EditPersonalFieldModal
          fieldId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={async () => { setEditingId(null); await farm.refreshFields(); }}
        />
      )}
      {loading ? <PageLoader /> : filteredFields.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground shadow-sm">
          <Sprout className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-semibold text-foreground mb-1">{allFields.length === 0 ? 'No fields yet' : 'No fields found'}</h3>
          <p>{allFields.length === 0 ? 'Add your first field to get started.' : 'Try adjusting your search or filter settings.'}</p>
          {allFields.length === 0 ? (
            <button onClick={onAdd} className="mt-4 text-primary font-semibold hover:underline">+ Add Field</button>
          ) : (
            <button onClick={() => { setFilter('All'); setSearch(''); }} className="mt-4 text-primary font-semibold hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFields.map((f: any) => <FieldCard key={f.id || f.name} {...f} isDemo={isDemo} fieldId={f.id} selected={f.id === farm.selectedFieldId} onSelect={() => farm.setSelectedFieldId(f.id)} onNavigate={onNavigate} onEdit={isDemo ? undefined : () => setEditingId(f.id)} onDelete={isDemo ? undefined : () => void deletePersonalField(f.id, f.name)} deleting={deletingId === f.id} />)}
        </div>
      )}
    </div>
  );
}

function FieldCard({ name, area, area_ha, crop, current_crop, condition, moisture, ndvi, stress, lastObs, rainfall_trend, temp_trend, onNavigate, onSelect, selected, onEdit, onDelete, deleting, isDemo, fieldId }: any) {
  const personal = useSharedFieldMetrics(fieldId, !isDemo);
  const shared = personal.data?.metrics;
  const cardArea = isDemo ? area : (typeof area_ha === 'number' ? `${area_ha.toFixed(3)} ha` : '—');
  const cardCrop = isDemo ? crop : (current_crop || crop || '—');
  const cardCondition = isDemo ? condition : (personal.loading ? 'Loading…' : personal.error ? 'Unavailable' : 'Observed');
  const cardMoisture = isDemo ? moisture : sharedNumber(shared?.root_zone_wetness_pct, 1, '%');
  const cardNdvi = isDemo ? ndvi : sharedNumber(shared?.ndvi, 3);
  const cardStress = isDemo ? stress : (shared?.water_stress || 'Not assessed');
  const cardLastObs = isDemo ? lastObs : (shared?.period?.end || '—');
  const cardRainfall = isDemo ? rainfall_trend : sharedNumber(shared?.rainfall_mm, 1, ' mm');
  const cardTemp = isDemo ? temp_trend : sharedNumber(shared?.temperature_c, 1, '°C');
  const [showContext, setShowContext] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  return (
    <div className={`group relative bg-card border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-auto min-h-[440px] md:h-[340px] ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
      <div className="p-6 flex-1 flex flex-col relative z-10 bg-card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-display font-semibold text-2xl text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{cardArea} • Current crop: {cardCrop}</p>
          </div>
          <div className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider text-muted-foreground border border-border">{cardLastObs}</div>
        </div>
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-4 flex-1">
          <div><div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Condition</div><div className="font-medium">{cardCondition}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Soil Moisture</div><div className="font-medium">{cardMoisture}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">NDVI</div><div className="font-medium font-mono">{cardNdvi}</div></div>
          <div className="relative">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Water Stress</div>
            <button onClick={() => setShowContext(!showContext)} className={`font-medium ${cardStress === 'High' ? 'text-destructive' : cardStress === 'Moderate' ? 'text-accent' : 'text-primary'} hover:underline flex items-center gap-1`}>
              {cardStress} <Info className="w-3 h-3" />
            </button>
            {showContext && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border p-3 rounded shadow-xl z-50 text-xs">
                <div className="font-semibold mb-2">Why {cardStress?.toLowerCase()} stress?</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Root wetness: {cardMoisture}</li>
                  <li>• Rainfall: {cardRainfall || '—'}</li>
                  <li>• Temp: {cardTemp || '—'}</li>
                </ul>
                <button onClick={() => setShowContext(false)} className="mt-2 text-primary font-medium">Close</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {onEdit && onDelete && (
        <div className="absolute right-4 top-[76px] z-30 flex gap-2">
          <button type="button" onClick={onEdit} className="rounded border border-[#174D3B]/20 bg-white px-3 py-1 text-xs font-semibold text-[#174D3B] hover:bg-[#e8f0ea]">Edit</button>
          <button type="button" onClick={onDelete} disabled={deleting} className="rounded border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      )}
      <div className="relative md:absolute left-0 right-0 bottom-0 bg-card/95 backdrop-blur-md border-t border-border translate-y-0 md:translate-y-[120%] md:group-hover:translate-y-0 transition-transform duration-300 p-4 z-20 flex flex-col justify-between min-h-[180px] md:h-[180px]">
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-muted-foreground block text-xs mb-1">Rainfall trend</span><span className="font-medium text-accent">{cardRainfall || '—'}</span></div>
          <div><span className="text-muted-foreground block text-xs mb-1">Temp trend</span><span className="font-medium text-accent">{cardTemp || '—'}</span></div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={() => { onSelect(); onNavigate('Field Intelligence'); }} className="flex-1 bg-primary text-primary-foreground py-2 rounded font-medium text-sm hover:bg-primary/90">View Field</button>
            <button onClick={() => { onSelect(); onNavigate('Rotation Planner'); }} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded font-medium text-sm hover:bg-secondary/80 border border-border">Plan Next Crop</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { onSelect(); onNavigate('Data Explorer'); }} className="flex-1 bg-muted text-foreground py-1.5 rounded font-medium text-sm hover:bg-muted/80 border border-border">History</button>
            <button onClick={() => setMonitoring(!monitoring)} className="flex-1 bg-muted text-foreground py-1.5 rounded font-medium text-sm hover:bg-muted/80 border border-border flex items-center justify-center gap-1">
              {monitoring ? <><CheckCircle2 className="w-4 h-4 text-primary"/> Monitoring</> : 'Monitor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type CropHistoryRecord = { crop_id: string; season: string; year: number; start_month: number | null; end_month: number | null; yield_t_ha: number | null };
type CropHistoryDraft = { crop_id: string; season: string; year: string; start_month: string; end_month: string; yield_t_ha: string };

const CROP_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CropHistoryEditor({ value, onChange, crops }: {
  value: CropHistoryDraft[];
  onChange: (rows: CropHistoryDraft[]) => void;
  crops: Array<{ id: string; name: string }>;
}) {
  const input = 'w-full min-w-0 rounded-lg border border-[#e0ddd6] bg-[#fbfaf7] px-2 py-2 text-sm focus:border-[#174D3B] outline-none';
  const update = (index: number, key: keyof CropHistoryDraft, next: string) =>
    onChange(value.map((row, i) => i === index ? { ...row, [key]: next } : row));
  return (
    <section className="rounded-xl border border-[#dce7df] bg-[#f5f8f5] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold text-[#174D3B]">Crop History</h4>
          <p className="text-xs text-gray-600">Add actual past crops in chronological order. Do not enter planned crops.</p>
        </div>
        <button type="button" className="rounded-lg bg-[#174D3B] px-3 py-2 text-xs font-semibold text-white" onClick={() => onChange([...value, { crop_id: '', season: '', year: String(new Date().getFullYear()), start_month: '', end_month: '', yield_t_ha: '' }])}>+ Add crop</button>
      </div>
      {value.length === 0 && <p className="text-sm text-gray-500">No crop history recorded yet.</p>}
      {value.map((row, index) => (
        <div key={index} className="rounded-lg border border-[#e0ddd6] bg-white p-3 space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-semibold text-gray-600">Record {index + 1}</span><button type="button" className="text-xs text-red-600" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs font-medium">Crop<select className={input} value={row.crop_id} onChange={e => update(index, 'crop_id', e.target.value)}><option value="">Select crop</option>{row.crop_id && !crops.some(c => c.id === row.crop_id) && <option value={row.crop_id}>{row.crop_id}</option>}{crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-xs font-medium">Season<input className={input} placeholder="e.g. Rabi, Aman (optional)" value={row.season} onChange={e => update(index, 'season', e.target.value)} /></label>
            <label className="text-xs font-medium">Start Month<select className={input} value={row.start_month} onChange={e => update(index, 'start_month', e.target.value)}><option value="">Not recorded</option>{CROP_MONTHS.map((month, i) => <option key={month} value={String(i + 1)}>{month}</option>)}</select></label>
            <label className="text-xs font-medium">End Month<select className={input} value={row.end_month} onChange={e => update(index, 'end_month', e.target.value)}><option value="">Not recorded</option>{CROP_MONTHS.map((month, i) => <option key={month} value={String(i + 1)}>{month}</option>)}</select></label>
            <label className="text-xs font-medium">Year<input className={input} type="number" min="1900" max={new Date().getFullYear()} value={row.year} onChange={e => update(index, 'year', e.target.value)} /></label>
            <label className="text-xs font-medium">Yield (t/ha, optional)<input className={input} type="number" min="0" step="any" placeholder="Optional" value={row.yield_t_ha} onChange={e => update(index, 'yield_t_ha', e.target.value)} /></label>
          </div>
        </div>
      ))}
    </section>
  );
}

function EditPersonalFieldModal({ fieldId, onClose, onSaved }: {
  fieldId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { lookups } = useFarm();
  const [original, setOriginal] = useState<any>(null);
  const [name, setName] = useState('');
  const [crop, setCrop] = useState('');
  const [irrigation, setIrrigation] = useState('rainfed');
  const [waterSource, setWaterSource] = useState('rain');
  const [cropHistory, setCropHistory] = useState<CropHistoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getField(fieldId).then((field: any) => {
      if (cancelled) return;
      setOriginal(field);
      setName(field.name || '');
      setCrop(field.current_crop || '');
      setIrrigation(field.irrigation_type || 'rainfed');
      setWaterSource(field.water_source || 'rain');
      setCropHistory((field.crop_history || []).map((item: CropHistoryRecord) => ({ crop_id: item.crop_id, season: item.season || '', year: String(item.year), start_month: item.start_month == null ? '' : String(item.start_month), end_month: item.end_month == null ? '' : String(item.end_month), yield_t_ha: item.yield_t_ha == null ? '' : String(item.yield_t_ha) })));
    }).catch((err: any) => {
      if (!cancelled) setError(err?.message || 'Could not load field.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fieldId]);

  const save = async () => {
    if (!original || !name.trim()) { setError('Field name is required.'); return; }
    const currentYear = new Date().getFullYear();
    for (const [index, row] of cropHistory.entries()) {
      const year = Number(row.year);
      const yieldValue = row.yield_t_ha.trim() === '' ? null : Number(row.yield_t_ha);
      if (!row.crop_id || !/^\d{4}$/.test(row.year) || !Number.isInteger(year) || year < 1900 || year > currentYear || (yieldValue !== null && (!Number.isFinite(yieldValue) || yieldValue < 0)) || (row.start_month !== '' && (!Number.isInteger(Number(row.start_month)) || Number(row.start_month) < 1 || Number(row.start_month) > 12)) || (row.end_month !== '' && (!Number.isInteger(Number(row.end_month)) || Number(row.end_month) < 1 || Number(row.end_month) > 12))) {
        setError(`Crop history record ${index + 1}: enter a valid crop, year, months (if provided) and non-negative yield.`);
        return;
      }
    }
    const historyPayload: CropHistoryRecord[] = cropHistory.map(row => ({
      crop_id: row.crop_id, season: row.season.trim(), year: Number(row.year),
      start_month: row.start_month === '' ? null : Number(row.start_month),
      end_month: row.end_month === '' ? null : Number(row.end_month),
      yield_t_ha: row.yield_t_ha.trim() === '' ? null : Number(row.yield_t_ha),
    }));
    setSaving(true);
    setError('');
    try {
      await api.updateField(fieldId, {
        name: name.trim(),
        boundary: original.boundary,
        irrigation_type: irrigation,
        water_source: waterSource,
        soil: original.soil,
        crop_history: historyPayload,
        division: original.division,
        district: original.district,
        current_crop: crop,
        previous_crops: original.previous_crops || [],
        existing_rotation: original.existing_rotation || [],
      });
      await onSaved();
    } catch (err: any) {
      setError(err?.message || 'Could not update field.');
    } finally { setSaving(false); }
  };

  const inputClass = 'w-full rounded-lg border border-[#e0ddd6] bg-[#fbfaf7] px-3 py-2.5 text-sm outline-none focus:border-[#174D3B]';
  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Edit field">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-[#174D3B]">Edit Field</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {loading ? <PageLoader /> : original && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Field Name<input className={`${inputClass} mt-1`} value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="block text-sm font-medium">Current Crop
              <select className={`${inputClass} mt-1`} value={crop} onChange={e => setCrop(e.target.value)}>
                <option value="">Unspecified</option>
                {crop && !lookups.crops.some(c => c.name === crop) && <option value={crop}>{crop}</option>}
                {lookups.crops.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Irrigation Type
              <select className={`${inputClass} mt-1`} value={irrigation} onChange={e => setIrrigation(e.target.value)}>
                {['rainfed', 'supplemental', 'irrigated'].map(value => <option key={value} value={value}>{lookups.irrigation_types.find(i => i.id === value)?.label || value}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Water Source
              <select className={`${inputClass} mt-1`} value={waterSource} onChange={e => setWaterSource(e.target.value)}>
                {waterSource && !lookups.water_sources.some(w => w.id === waterSource) && <option value={waterSource}>{waterSource}</option>}
                {lookups.water_sources.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </label>
            <CropHistoryEditor value={cropHistory} onChange={setCropHistory} crops={lookups.crops || []} />
            <p className="text-xs text-gray-500">Field boundary and soil properties remain unchanged.</p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2.5 font-semibold">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={loading || saving || !original} className="flex-1 rounded-lg bg-[#174D3B] py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page 04: Field Intelligence ─────────────────────────────────────────────
// Personal Field Intelligence uses the exact shared metrics used by Reports.
function usePersonalFieldCondition(fieldId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<import('./api').PersonalFieldConditionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    if (!enabled || !fieldId) { setLoading(false); return; }
    setLoading(true);
    api.getPersonalFieldCondition(fieldId)
      .then(result => {
        if (cancelled) return;
        if (result.field_id !== fieldId || result.source !== 'real') {
          setError('Verified NASA-only field condition data is unavailable. Partial or mock-sourced assessments are not displayed.');
          return;
        }
        setData(result);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Condition assessment unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fieldId, enabled]);
  return { data, loading, error };
}

function useSharedFieldMetrics(fieldId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    if (!enabled || !fieldId) { setLoading(false); return; }
    setLoading(true);
    api.getPersonalFieldIntelligence(fieldId)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'NASA observations unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, fieldId]);
  return { data, loading, error };
}

const sharedNumber = (value: unknown, digits: number, unit = '') =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : '—';

// ET is an estimate in the existing environment indicators, not a direct field measurement.
// Never show it from a mock fallback in Personal Mode.
function personalETLabel(environment: any): string {
  if (!environment || !['real', 'partial'].includes(environment.source)) return 'Not assessed';
  const indicators = environment.indicators;
  const value = indicators?.et_mm_per_day;
  const estimated = indicators?.et_estimated === 1 || indicators?.et_estimated === true;
  if (!estimated || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 25) {
    return 'Not assessed';
  }
  return `${value.toFixed(2)} mm/day (estimated)`;
}


// Historical series is field-specific and is never displayed from mock fallback in Personal Mode.
function usePersonalFieldHistory(fieldId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    if (!enabled || !fieldId) { setLoading(false); return; }
    setLoading(true);
    api.getPersonalEnvironment(fieldId, false)
      .then(result => {
        if (cancelled) return;
        if (result?.field_id !== fieldId || !['real', 'partial'].includes(result?.source)) {
          setError('Verified NASA historical observations are unavailable for this field.');
          return;
        }
        setData(result);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Historical observations unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fieldId, enabled]);
  return { data, loading, error };
}

function makeWetnessHistory(environment: any): Array<{ date: string; wetness: number | null }> {
  const dates = environment?.daily?.dates;
  const values = environment?.daily?.soil_moisture;
  if (!Array.isArray(dates) || !Array.isArray(values)) return [];
  return dates.map((date: unknown, index: number) => {
    const raw = values[index];
    const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 1;
    return { date: String(date), wetness: valid ? Number((raw * 100).toFixed(2)) : null };
  }).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
}

// Five transparent, provisional display indices from observed field values.
// These are NOT calibrated field-health or yield predictions.
function buildFiveConditionIndicators(assessment: any, shared: any) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const raw = assessment?.dimensions;
  const find = (key: string): any => Array.isArray(raw)
    ? raw.find((item: any) => item.key === key)
    : raw && typeof raw === 'object' ? raw[key] : null;
  const observed = (key: string, fallback: unknown) => {
    const v = find(key)?.observed_value;
    return valid(v) ? v : valid(fallback) ? fallback : null;
  };
  const wet = observed('soil_moisture', shared?.root_zone_wetness_pct);
  const rain = observed('rainfall', shared?.rainfall_mm);
  const temp = observed('temperature', shared?.temperature_c);
  const ndvi = observed('vegetation_health', shared?.ndvi);
  // Display observed temperature numerically on the requested 0–100 scale.
  const tempScore = valid(temp) ? clamp(temp) : null;
  const period = assessment?.period || shared?.period;
  const days = period?.start && period?.end
    ? Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86400000) + 1
    : null;
  // Rainfall index: period-average rainfall capped at 5 mm/day = 100%.
  // Explicitly a display normalization, not rainfall suitability.
  const rainPct = valid(rain) && valid(days) && days > 0 ? clamp((rain / days / 5) * 100) : null;
  const items = [
    { key: 'soil_moisture', name: 'Soil Moisture', score: valid(wet) ? clamp(wet) : null,
      detail: valid(wet) ? `Observed: ${wet.toFixed(1)}%` : 'Data unavailable' },
    { key: 'rainfall', name: 'Rainfall', score: rainPct,
      detail: valid(rain) ? `Observed: ${rain.toFixed(1)} mm` : 'Data unavailable' },
    { key: 'temperature', name: 'Temperature', score: tempScore,
      detail: valid(temp) ? `Observed: ${temp.toFixed(1)}°C` : 'Data unavailable' },
    { key: 'vegetation_health', name: 'Vegetation Health', score: valid(ndvi) ? clamp(ndvi * 100) : null,
      detail: valid(ndvi) ? `Observed NDVI: ${ndvi.toFixed(3)}` : 'Data unavailable' },
    { key: 'water_availability', name: 'Water Availability', score: valid(wet) ? clamp(wet) : null,
      detail: valid(wet) ? `Observed: ${wet.toFixed(1)}%` : 'Data unavailable' },
  ];
  const allAvailable = items.every(item => item.score !== null);
  const average = allAvailable
    ? items.reduce((sum, item) => sum + (item.score ?? 0), 0) / items.length
    : null;
  return { items, average };
}

function FieldIntelligence({ onNavigate, isDemo }: { onNavigate: (tab: string) => void; isDemo: boolean }) {
  const farm = useFarm();
  const demo = useApiFetch<any>(isDemo ? '/api/field-intelligence' : '');
  const personal = useSharedFieldMetrics(farm.selectedFieldId, !isDemo);
  const history = usePersonalFieldHistory(farm.selectedFieldId, !isDemo);
  const conditionAssessment = usePersonalFieldCondition(farm.selectedFieldId, !isDemo);
  const fieldConditionIndices = buildFiveConditionIndicators(conditionAssessment.data, personal.data?.metrics);
  const [historyRange, setHistoryRange] = useState('30D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const loading = isDemo ? demo.loading : personal.loading;
  const data = isDemo ? demo.data : null;
  const shared = personal.data?.metrics;
  const selectedName = isDemo ? data?.field_name : (personal.data?.field_name || farm.selectedField?.name);
  const conditionLabel = isDemo ? data?.condition?.label : (shared?.water_stress ? `${shared.water_stress} water stress (indicative)` : 'Environmental observations');
  const mapCenter: [number, number] = fieldCenter(data || farm.selectedField);
  const verts = geoJSONToVertices(data?.boundary || farm.selectedField?.boundary);

  const cond = data?.condition || {};
  const metrics = isDemo ? (data?.metrics || {}) : {
    soil_moisture: sharedNumber(shared?.root_zone_wetness_pct, 1, '%'),
    rainfall: sharedNumber(shared?.rainfall_mm, 1, ' mm'),
    ndvi: sharedNumber(shared?.ndvi, 3),
    temperature: sharedNumber(shared?.temperature_c, 1, '°C'),
    et: personalETLabel(history.data),
  };
  const bars = isDemo ? (data?.condition_bars || []) : [];
  const observations = isDemo ? (data?.observations || []) : [];
  const lineData = isDemo ? (data?.historical_chart || []) : [];
  const coverage = shared?.coverage || {};
  const expected = Number(coverage.expected_days) || 0;
  const coverageBars = [
    { label: 'Root-zone Wetness Coverage', count: coverage.wetness_days },
    { label: 'Rainfall Coverage', count: coverage.rainfall_days },
    { label: 'Temperature Coverage', count: coverage.temperature_days },
    { label: 'NDVI Coverage', count: coverage.ndvi_days },
  ].map(item => ({ label: item.label, value: expected > 0 ? Math.min(100, Math.round((Number(item.count) || 0) / expected * 100)) : 0 }));
  const historyAll = !isDemo ? makeWetnessHistory(history.data) : [];
  const latestDate = historyAll.length ? historyAll[historyAll.length - 1].date : '';
  const days = historyRange === '7D' ? 7 : historyRange === '30D' ? 30 : historyRange === '3M' ? 90 : historyRange === '1Y' ? 365 : 1826;
  const cutoff = latestDate && historyRange !== 'Custom' ? (() => {
    const date = new Date(`${latestDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days + 1);
    return date.toISOString().slice(0, 10);
  })() : '';
  const historyVisible = historyAll.filter(row => historyRange === 'Custom'
    ? (!!customStart && !!customEnd && row.date >= customStart && row.date <= customEnd)
    : row.date >= cutoff);
  const validHistory = historyVisible.filter(row => row.wetness !== null);
  const latestVisible = validHistory.length ? validHistory[validHistory.length - 1].wetness : null;
  const availableStart = historyAll[0]?.date;
  const availableEnd = historyAll[historyAll.length - 1]?.date;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      <header className="mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
          {farm.farmName} <ChevronRight className="w-3 h-3" /> {selectedName || 'Field'} <ChevronRight className="w-3 h-3" /> {(isDemo ? data?.area_ha : null) ?? farm.selectedField?.area_ha ?? '—'} ha <ChevronRight className="w-3 h-3" /> Current: {(isDemo ? data?.current_crop : null) || farm.selectedField?.current_crop || farm.selectedField?.crop || '—'}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold mb-1">Field Intelligence</h2>
            <p className="text-muted-foreground text-lg">Understand what is happening in {selectedName || 'the selected field'}.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-card border border-border text-foreground font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-muted">Compare Historical Data</button>
            <button onClick={() => onNavigate('Crop Analysis')} className="bg-card border border-border text-foreground font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-muted hidden lg:block">View Crop Analysis</button>
            <button onClick={() => onNavigate('Rotation Planner')} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-primary/90">Plan Next Crop</button>
          </div>
        </div>
      </header>

      {!isDemo && personal.error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{personal.error}</div>}
      {!isDemo && !farm.selectedFieldId && <p className="text-muted-foreground">Select a field to load NASA observations.</p>}
      {loading ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden h-[300px] relative">
              <MapContainer center={mapCenter} zoom={15} zoomControl={false} dragging={false} scrollWheelZoom={false} className="h-full w-full" key={farm.selectedFieldId || 'intel'}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                {verts.length >= 3 && <Polygon positions={verts} pathOptions={{ color: '#1e4533', weight: 4, fillColor: '#1e4533', fillOpacity: 0.35, dashArray: '10, 10' }} />}
              </MapContainer>
            </div>
            <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col justify-center">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Current Condition</h3>
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
                <div className="text-3xl font-display font-semibold text-accent">{conditionLabel || '—'}</div>
                <div className="bg-accent/10 border border-accent/20 text-accent-foreground px-3 py-1 rounded text-sm font-medium">{isDemo ? (cond.status || '—') : (shared?.source || 'Unavailable')}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div><div className="text-xs text-muted-foreground mb-1">Soil Moisture</div><div className="text-xl font-semibold">{metrics.soil_moisture || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">Rainfall</div><div className="text-xl font-semibold">{metrics.rainfall || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">NDVI</div><div className="text-xl font-semibold">{metrics.ndvi || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">Temperature</div><div className="text-xl font-semibold">{metrics.temperature || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">ET</div><div className="text-xl font-semibold">{metrics.et || '—'}</div></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6 border-b border-border pb-3">
                <h3 className="font-semibold text-lg">Current Field Condition</h3>
                
              </div>
              <div className="flex items-center gap-5 mb-7">
                <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex flex-col items-center justify-center shrink-0">
                  <div className="text-2xl font-bold text-foreground">{isDemo ? (cond.health_score ?? '—') : fieldConditionIndices.average === null ? '—' : Math.round(fieldConditionIndices.average)}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold">/ 100</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{isDemo ? (cond.health_label || '—') : fieldConditionIndices.average === null ? 'Field Health Score' : fieldConditionIndices.average >= 80 ? 'Healthy' : fieldConditionIndices.average >= 60 ? 'Moderately Healthy' : fieldConditionIndices.average >= 40 ? 'Fair Condition' : 'Needs Attention'}</div>
                  <p className="text-sm text-muted-foreground mt-1">{isDemo ? `Based on ${cond.dimensions_count || 6} demo dimensions` : 'Based on 5 environmental dimensions'}</p>
                  {!isDemo && conditionAssessment.data?.period && <p className="text-xs text-muted-foreground mt-1">{conditionAssessment.data.period.start} to {conditionAssessment.data.period.end}</p>}
                </div>
              </div>
              {!isDemo && conditionAssessment.error && <p role="alert" className="text-sm text-red-700 mb-4">{conditionAssessment.error}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {isDemo ? bars.filter((b: any) => !String(b.label).toLowerCase().includes('drought')).map((b: any) => <ConditionBar key={b.label} label={b.label} value={b.value} color="bg-primary" />)
                  : conditionAssessment.loading ? <p className="text-sm text-muted-foreground">Calculating field indicators…</p>
                  : fieldConditionIndices.items.map(d => (
                    <div key={d.key}>
                      <div className="flex justify-between items-center gap-2 text-sm mb-1.5">
                        <span className="font-medium text-muted-foreground">{d.name}</span>
                        <span className="font-semibold">{d.score === null ? '—' : `${d.key === 'temperature' ? d.score.toFixed(1) : Math.round(d.score)}%`}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${d.key === 'temperature' ? 'bg-orange-400' : d.key === 'rainfall' || d.key === 'soil_moisture' ? 'bg-[#468fbd]' : 'bg-[#214d3b]'}`} style={{width: `${d.score ?? 0}%`}} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{d.detail}</p>
                    </div>
                  ))}
              </div>
              
            </div>
            <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between gap-2 mb-4 border-b border-border pb-3">
                <h3 className="font-semibold text-lg">Key Observations</h3>
                <Leaf className="w-4 h-4 text-primary" />
              </div>
              {isDemo ? <ul className="space-y-4">{observations.map((obs: string, i: number) => <ObservationItem key={i} text={obs} />)}</ul>
                : conditionAssessment.loading ? <p className="text-sm text-muted-foreground">Loading observations…</p>
                : <div className="space-y-3">
                    {(conditionAssessment.data?.observations || []).map(obs => (
                      <div key={obs.key} className={`rounded-lg border p-3.5 ${obs.severity === 'warning' ? 'border-amber-200 bg-amber-50/60' : obs.severity === 'success' ? 'border-emerald-200 bg-emerald-50/60' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-start gap-2.5">
                          {obs.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                          <div><h4 className="text-sm font-semibold text-foreground">{obs.title}</h4><p className="text-xs leading-relaxed text-muted-foreground mt-1">{obs.description}</p></div>
                        </div>
                      </div>
                    ))}
                    {!conditionAssessment.data && <p className="text-sm text-muted-foreground">{conditionAssessment.error || 'Select a field to see observations.'}</p>}
                    {conditionAssessment.data && <p className="text-[11px] text-muted-foreground pt-2">Source: {conditionAssessment.data.source || 'unavailable'} · Field-specific observations</p>}
                  </div>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6" id="field-history">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6 border-b border-border pb-4">
              <h3 className="font-semibold text-lg">Historical Analysis: Root-zone Wetness</h3>
              <div className="flex flex-wrap gap-2">
                {['7D', '30D', '3M', '1Y', '5Y', 'Custom'].map(t => (
                  <button key={t} type="button" onClick={() => setHistoryRange(t)}
                    className={`text-xs font-semibold px-2 py-1 rounded ${historyRange === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-border'}`}>{t}</button>
                ))}
              </div>
            </div>
            {!isDemo && historyRange === 'Custom' && <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              <label>From <input type="date" value={customStart} min={availableStart} max={availableEnd} onChange={e => setCustomStart(e.target.value)} className="ml-2 rounded border border-border p-2" /></label>
              <label>To <input type="date" value={customEnd} min={availableStart} max={availableEnd} onChange={e => setCustomEnd(e.target.value)} className="ml-2 rounded border border-border p-2" /></label>
            </div>}
            <div className="mb-5">
              <div className="text-2xl font-display font-semibold text-foreground">{isDemo ? (data?.current_value || '—') : sharedNumber(latestVisible, 1, '%')}</div>
              <p className="text-sm text-muted-foreground mt-2">{isDemo ? (data?.historical_context || 'Demo data') :
                history.loading ? 'Loading authenticated NASA observations…' :
                history.error ? history.error :
                `NASA POWER model-derived root-zone wetness · ${validHistory.length} valid observations in selected range`}</p>
              {!isDemo && availableStart && <p className="text-xs text-muted-foreground mt-1">Available observation period: {availableStart} to {availableEnd}. Longer ranges show available data only, not invented history.</p>}
            </div>
            {isDemo ? <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" hide />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="current" name="Demo observations" stroke="var(--color-primary)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="historical" name="Demo historical average" stroke="var(--color-muted-foreground)" strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div> : validHistory.length > 0 ? <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyVisible}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={32} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => value == null ? 'Unavailable' : `${Number(value).toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="wetness" name="NASA POWER root-zone wetness" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div> : <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              {history.loading ? 'Loading daily observations…' : historyRange === 'Custom' && (!customStart || !customEnd)
                ? 'Choose a start and end date to view observations.' : 'No verified daily NASA root-zone wetness observations for this range.'}
            </div>}
            {isDemo && <div className="mt-4 text-xs text-muted-foreground">Demo Mode — illustrative data</div>}
          </div>
        </>
      )}
    </div>
  );
}

function ConditionBar({ label, value, color }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm font-medium mb-1">
        <span className="text-muted-foreground">{label}</span><span className="text-foreground">{value}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}
function ObservationItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
      <span className="text-sm text-foreground leading-relaxed">{text}</span>
    </li>
  );
}

// ─── Page 05: Crop Analysis ───────────────────────────────────────────────────
function CropAnalysis({ onNavigate, isDemo }: { onNavigate: (tab: string) => void; isDemo: boolean }) {
  const farm = useFarm();
  const fieldId = farm.selectedFieldId;
  const { data: baseData, loading: demoLoading } = useApiFetch<any>(isDemo ? '/api/crop-suitability' : '');
  const personalEnvironment = usePersonalNASA(!isDemo);
  const [viewMode, setViewMode] = useState<'cards' | 'compare'>('cards');
  const [whyCrop, setWhyCrop] = useState<any>(null);
  const [priorities, setPriorities] = useState({ water: 50, drought: 50, heat: 50, yield: 50, profit: 50, soil: 50, weather: 50, diversity: 50 });
  const [scoredCrops, setScoredCrops] = useState<any[]>([]);
  const [scoring, setScoring] = useState(false);
  const [suitabilityError, setSuitabilityError] = useState('');
  const [personalSource, setPersonalSource] = useState('');
  const [personalQuality, setPersonalQuality] = useState<number | null>(null);

  const updatePriority = (key: keyof typeof priorities, val: number) =>
    setPriorities(previous => ({ ...previous, [key]: val }));

  useEffect(() => {
    setWhyCrop(null);
    setScoredCrops([]);
    setSuitabilityError('');
    setPersonalSource('');
    setPersonalQuality(null);
    if (isDemo && baseData?.crops) setScoredCrops(baseData.crops);
  }, [fieldId, isDemo, baseData]);

  useEffect(() => {
    if (!fieldId) {
      setScoring(false);
      setScoredCrops([]);
      return;
    }
    let cancelled = false;
    setScoring(true);
    setSuitabilityError('');
    if (!isDemo) {
      setScoredCrops([]);
      setPersonalSource('');
      setPersonalQuality(null);
    }
    const timer = window.setTimeout(async () => {
      try {
        if (isDemo) {
          const result = await api.scoreCrops(priorities, fieldId);
          if (!cancelled) setScoredCrops(result.crops || []);
        } else {
          const result = await api.getPersonalCropSuitability(fieldId, {
            water: priorities.water / 100,
            yield_potential: priorities.yield / 100,
            soil_health: priorities.soil / 100,
            risk: priorities.weather / 100,
          });
          if (cancelled) return;
          if (result.data_source === 'mock') throw new Error('Only demo data is available for this field. Personal recommendations require environmental observations.');
          const mapped = (result.results || []).map((crop: any) => ({
            id: crop.crop_id,
            name: crop.crop_name,
            score: Number(crop.total_score) || 0,
            recommended: crop.recommended,
            notRecommendedReason: crop.not_recommended_reason,
            components: crop.components || {},
            weights: crop.weights || {},
            explanation: Array.isArray(crop.explanation) ? crop.explanation : [],
            seasonAssessment: crop.season_assessment ?? null,
            why: Array.isArray(crop.explanation)
              ? crop.explanation.map((entry: any) => entry.text).filter(Boolean).join(' ')
              : '',
          }));
          setScoredCrops(mapped);
          setPersonalSource(result.data_source || 'unknown');
          setPersonalQuality(typeof result.data_quality === 'number' ? result.data_quality : null);
        }
      } catch (error) {
        if (!cancelled) {
          setSuitabilityError(error instanceof Error ? error.message : 'Crop suitability unavailable');
          setScoredCrops([]);
        }
      } finally {
        if (!cancelled) setScoring(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isDemo, fieldId, priorities]);

  const observed = personalEnvironment.data?.indicators || {};
  const formatObserved = (key: string, suffix: string, digits = 1) =>
    typeof observed[key] === 'number' && Number.isFinite(observed[key])
      ? `${observed[key].toFixed(digits)}${suffix}` : 'Not available';
  const activePriorities = Object.entries(priorities).filter(([key, value]) =>
    value > 60 && (isDemo || ['water', 'yield', 'soil', 'weather'].includes(key)));
  const scoreDisplay = (score: unknown) => typeof score === 'number' ? score.toFixed(1) : '—';
  const seasonStatus = (crop: any): string => {
    const assessment = crop?.seasonAssessment;
    if (!assessment || assessment.status === 'not_assessed' || assessment.compatible == null) return 'Not assessed';
    if (assessment.compatible === true) return 'Within verified window';
    if (assessment.compatible === false) return 'Outside verified window';
    return 'Not assessed';
  };
  const seasonReason = (crop: any): string =>
    crop?.seasonAssessment?.reason || 'Verified planting calendar data is not available for this crop.';
  const seasonNames = (crop: any): string => {
    const matches = crop?.seasonAssessment?.matching_seasons;
    if (!Array.isArray(matches) || matches.length === 0) return 'None verified';
    return matches.map((season: any) => typeof season === 'string'
      ? season : (season?.name || season?.season_id || 'Unnamed season')).join(', ');
  };
  const loading = scoring || (isDemo && demoLoading);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 relative">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-1">Crop Suitability</h2>
          <p className="text-muted-foreground text-lg">Explore crop options for {isDemo ? (baseData?.field || farm.selectedField?.name || 'the demo field') : (farm.selectedField?.name || 'your selected field')}.</p>
        </div>
        <div className="flex bg-muted rounded-md p-1 border border-border">
          <button onClick={() => setViewMode('cards')} className={`px-4 py-1.5 rounded text-sm font-medium ${viewMode === 'cards' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>Cards</button>
          <button onClick={() => setViewMode('compare')} className={`px-4 py-1.5 rounded text-sm font-medium ${viewMode === 'compare' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>Compare</button>
        </div>
      </header>

      {!isDemo && personalSource && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-primary">Environmental source: {personalSource.toUpperCase()}</span>
            {personalQuality !== null && <span className="text-xs text-muted-foreground">Pipeline data-quality indicator: {(personalQuality * 100).toFixed(1)}%</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-2">These are rule-based suitability estimates using field information and environmental data, not measured crop yields or scientifically validated predictions. Data-quality indicator does not measure prediction accuracy.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm sticky top-6">
            <h3 className="font-semibold text-lg mb-6">What matters most to you?</h3>
            <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2">
              <SuitabilitySlider label="Water Saving" val={priorities.water} setVal={(v: number) => updatePriority('water', v)} color="bg-water" />
              {isDemo && <SuitabilitySlider label="Drought Resilience" val={priorities.drought} setVal={(v: number) => updatePriority('drought', v)} color="bg-accent" />}
              {isDemo && <SuitabilitySlider label="Heat Resilience" val={priorities.heat} setVal={(v: number) => updatePriority('heat', v)} color="bg-accent" />}
              <SuitabilitySlider label="Yield Potential Priority" val={priorities.yield} setVal={(v: number) => updatePriority('yield', v)} color="bg-primary" />
              {isDemo && <SuitabilitySlider label="Profit Potential" val={priorities.profit} setVal={(v: number) => updatePriority('profit', v)} color="bg-[#8a6c52]" />}
              <SuitabilitySlider label="Soil Health" val={priorities.soil} setVal={(v: number) => updatePriority('soil', v)} color="bg-[#8a6c52]" />
              <SuitabilitySlider label={isDemo ? 'Weather Resilience' : 'Risk Priority'} val={priorities.weather} setVal={(v: number) => updatePriority('weather', v)} color="bg-primary" />
              {isDemo && <SuitabilitySlider label="Crop Diversity" val={priorities.diversity} setVal={(v: number) => updatePriority('diversity', v)} color="bg-primary" />}
            </div>
          </div>
        </div>

        <div className="xl:col-span-9 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-primary mb-1">Your priorities influence these modeled results</h4>
              <div className="flex flex-wrap gap-2 mt-2">
                {activePriorities.map(([key, value]) => <span key={key} className="bg-background border border-primary/30 text-primary text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">{key} {value}</span>)}
              </div>
            </div>
            <span className="text-xs text-primary/80 font-medium">Updates when priorities change</span>
          </div>

          {loading ? <PageLoader /> : suitabilityError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              <h3 className="font-semibold mb-2">Crop suitability unavailable</h3>
              <p className="text-sm">{suitabilityError}</p>
            </div>
          ) : scoredCrops.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="font-medium">No crop recommendations available.</p>
              <p className="text-sm text-muted-foreground mt-2">Select a field with available environmental observations.</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scoredCrops.map((c: any) => (
                <div key={c.id || c.name} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-md transition-all duration-500">
                  <div className="p-6 border-b border-border flex justify-between items-start">
                    <div>
                      <h3 className="font-display font-semibold text-2xl mb-1">{c.name}</h3>
                      <div className="text-xs text-muted-foreground font-medium">Rule-based estimate <span className="bg-muted px-1.5 rounded">{isDemo ? 'Demo' : 'Field-specific'}</span></div>
                      {!isDemo && c.recommended === false && <div className="text-xs text-destructive mt-2">Not recommended{c.notRecommendedReason ? `: ${c.notRecommendedReason}` : ''}</div>}
                    </div>
                    <div className="flex flex-col items-center justify-center bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
                      <span className={`text-2xl font-bold leading-none ${c.score > 70 ? 'text-primary' : c.score > 55 ? 'text-accent' : 'text-destructive'}`}>{scoreDisplay(c.score)}</span>
                      <span className="text-[8px] uppercase text-primary/80 font-bold tracking-wider mt-1">Suitability</span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 space-y-4 bg-muted/10">
                    {isDemo ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Water Req</div><div className="font-medium text-sm">{c.waterReq ?? '—'}</div></div>
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Climate</div><div className="font-medium text-sm">{c.climate ?? '—'}</div></div>
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Soil Comp</div><div className="font-medium text-sm">{c.soilComp ?? '—'}</div></div>
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Duration</div><div className="font-medium text-sm">{c.duration ?? '—'}</div></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(c.components || {}).map(([key, value]) => <div key={key}><div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{key.replace(/_/g, ' ')}</div><div className="font-medium text-sm">{typeof value === 'number' ? (value as number).toFixed(2) : String(value)}</div></div>)}
                      </div>
                    )}
                    {!isDemo && <div className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground font-medium">Planting season</span>
                        <span className="font-semibold">{seasonStatus(c)}</span>
                      </div>
                      {seasonStatus(c) === 'Not assessed' && <p className="mt-1 text-xs text-muted-foreground">{seasonReason(c)}</p>}
                    </div>}
                    <div className="pt-2"><div className="h-1.5 w-full bg-border rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${c.score > 70 ? 'bg-primary' : c.score > 55 ? 'bg-accent' : 'bg-destructive'}`} style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }} /></div></div>
                  </div>
                  <div className="p-4 bg-card flex gap-2 border-t border-border">
                    <button onClick={() => setWhyCrop(c)} className="flex-1 bg-card text-foreground border border-border py-2.5 rounded-lg font-medium text-sm hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors shadow-sm">Why this crop?</button>
                    <button onClick={() => onNavigate('Rotation Planner')} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1">Explore Rotations <ArrowRight className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead><tr className="border-b border-border bg-muted/30 text-sm text-muted-foreground uppercase tracking-wider"><th className="p-4">Crop</th><th className="p-4">Suitability</th><th className="p-4">{isDemo ? 'Water Req' : 'Water Fit'}</th><th className="p-4">{isDemo ? 'Climate' : 'Temperature Fit'}</th><th className="p-4">{isDemo ? 'Soil Comp' : 'Soil Fit'}</th>{!isDemo && <th className="p-4">Planting Season</th>}<th className="p-4 text-right">Actions</th></tr></thead>
                <tbody>{scoredCrops.map((c: any) => <tr key={c.id || c.name} className="border-b border-border last:border-0 hover:bg-muted/10"><td className="p-4 font-semibold">{c.name}</td><td className="p-4 font-bold">{scoreDisplay(c.score)}</td><td className="p-4 text-sm">{isDemo ? c.waterReq : (typeof c.components?.water === 'number' ? c.components.water.toFixed(2) : '—')}</td><td className="p-4 text-sm">{isDemo ? c.climate : (typeof c.components?.temp === 'number' ? c.components.temp.toFixed(2) : '—')}</td><td className="p-4 text-sm">{isDemo ? c.soilComp : (typeof c.components?.soil === 'number' ? c.components.soil.toFixed(2) : '—')}</td>{!isDemo && <td className="p-4 text-sm"><div className="font-medium">{seasonStatus(c)}</div><div className="text-xs text-muted-foreground">{seasonStatus(c) === 'Not assessed' ? seasonReason(c) : seasonNames(c)}</div></td>}<td className="p-4 text-right"><button onClick={() => setWhyCrop(c)} className="text-primary text-sm font-medium hover:underline">Why?</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm mt-8">
            <h3 className="font-semibold text-lg mb-2">How to interpret these results</h3>
            <p className="text-sm text-muted-foreground">Suitability scores compare modeled crop requirements with field conditions. They are decision-support estimates, not guaranteed yields. Rotation Planner is a separate module and may still use demo calculations until integrated.</p>
          </div>
        </div>
      </div>

      {whyCrop && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-card border-l border-border shadow-2xl z-[999] flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30"><h3 className="font-semibold text-lg">Why {whyCrop.name}?</h3><button onClick={() => setWhyCrop(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!isDemo && <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Selected Field Observations</h4>
              {personalEnvironment.loading ? <p className="text-sm">Loading observations…</p> : personalEnvironment.error ? <p className="text-sm text-red-700">{personalEnvironment.error}</p> : <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Root-zone relative wetness:</span><span className="font-semibold">{formatObserved('soil_moisture_latest_pct', '%')}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Period rainfall:</span><span className="font-semibold">{formatObserved('rain_total_mm', ' mm')}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Mean temperature:</span><span className="font-semibold">{formatObserved('mean_temp_c', '°C', 2)}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Longest confirmed dry spell:</span><span className="font-semibold">{formatObserved('dry_spell_max_days', ' days', 0)}</span></div>
                <p className="text-xs text-muted-foreground">Root-zone wetness is a relative index, not measured volumetric soil moisture. Missing observations can limit indicators.</p>
              </div>}
            </div>}
            {isDemo && <div><h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Demo Crop Characteristics</h4><div className="space-y-2 text-sm"><p>Water requirement: {whyCrop.waterReq ?? '—'}</p><p>Climate: {whyCrop.climate ?? '—'}</p><p>Soil: {whyCrop.soilComp ?? '—'}</p></div></div>}
            {!isDemo && <div><h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Suitability Components</h4><div className="space-y-2 text-sm">{Object.entries(whyCrop.components || {}).map(([key, value]) => <div key={key} className="flex justify-between border-b border-border/50 pb-2"><span className="capitalize">{key.replace(/_/g, ' ')}</span><span className="font-semibold">{typeof value === 'number' ? (value as number).toFixed(3) : String(value)}</span></div>)}</div>{whyCrop.recommended === false && <p className="mt-3 text-sm text-red-700">{whyCrop.notRecommendedReason || 'Not recommended by the current rules.'}</p>}</div>}
            {!isDemo && <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Planting Season Assessment</h4>
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Assessment month</span><span className="font-semibold">{typeof whyCrop.seasonAssessment?.month === 'number' ? new Date(2026, whyCrop.seasonAssessment.month - 1, 1).toLocaleString('en-US', { month: 'long' }) : 'Not available'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Compatibility</span><span className="font-semibold">{seasonStatus(whyCrop)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Matching seasons</span><span className="font-semibold text-right">{seasonNames(whyCrop)}</span></div>
                <p className="text-xs text-muted-foreground">{seasonReason(whyCrop)}</p>
                <p className="text-xs text-muted-foreground">Provisional calendar entries are not treated as verified planting advice. Suitability score is separate from season compatibility.</p>
              </div>
            </div>}
            <div><h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Explanation</h4>{!isDemo && whyCrop.explanation?.length ? <div className="space-y-3">{whyCrop.explanation.map((entry: any, index: number) => <p key={index} className="text-sm leading-relaxed bg-primary/5 border border-primary/10 p-3 rounded-lg">{entry.text || `${entry.component}: ${entry.impact}`}</p>)}</div> : <p className="text-sm leading-relaxed bg-primary/5 border border-primary/10 p-4 rounded-lg">{whyCrop.why || 'No detailed explanation available.'}</p>}</div>
            <div><h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Data Provenance</h4><div className="flex flex-wrap gap-2">{(isDemo ? (baseData?.data_sources || ['Demo crop dataset']) : (personalEnvironment.data?.sources || [personalSource || 'Environmental source not available'])).map((source: string) => <span key={source} className="bg-muted text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 rounded border border-border">{source}</span>)}</div></div>
          </div>
          <div className="p-4 border-t border-border bg-muted/10"><button onClick={() => { setWhyCrop(null); onNavigate('Rotation Planner'); }} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2">Explore Rotation Options <ArrowUpRight className="w-4 h-4" /></button></div>
        </div>
      )}
    </div>
  );
}

function SuitabilitySlider({ label, val, setVal, color }: any) {
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-foreground transition-colors group-hover:text-primary">{label}</span>
        <span className={`text-xs font-bold px-1.5 rounded transition-colors ${val<33?'bg-muted text-muted-foreground':val>66?'bg-primary/10 text-primary':'bg-accent/10 text-accent'}`}>{val}%</span>
      </div>
      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden flex transition-all group-hover:h-3">
        <div className={`h-full ${color} transition-all duration-300 ease-out`} style={{width:`${val}%`}}></div>
        <input type="range" min="0" max="100" value={val} onChange={(e)=>setVal(Number(e.target.value))} className="w-full absolute inset-0 opacity-0 cursor-pointer h-full" />
      </div>
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
        <span>Low Impact</span><span>High Impact</span>
      </div>
    </div>
  );
}

// ─── Day 6: Authenticated personal rotation planning ──────────────────────────
type RotationPriorities = {
  water: number; yield_potential: number; soil_health: number; risk: number;
};
type RotationStrategy = {
  strategy_id?: string; strategy_type?: string; title?: string;
  crop_ids?: string[]; crop_names?: string[]; slot_scores?: number[];
  score?: { total?: number; suitability?: number; water_impact?: number;
    soil_impact?: number; resilience?: number; yield_score?: number;
    explanation?: unknown };
  explanation?: unknown; warnings?: unknown;
  season_assessment?: {status?: string; reason?: string; verified?: boolean};
  planting_schedule?: Array<{
    slot?: number; crop_id?: string; crop_name?: string;
    reported_season?: string | null; reported_year?: number | null;
    proposed_planting_month?: number | null;
    season_assessment?: {status?: string; reason?: string; verified?: boolean};
    calendar_options?: Array<{
      season_id?: string; name?: string; planting_months?: number[];
      source?: string | null; verified?: boolean;
    }>;
  }>;
  benefits?: string[]; risks?: string[]; evidence?: string[]; limitations?: string[];
  [key: string]: unknown;
};
type PersonalRotationResponse = {
  field_id: string; data_source?: string; simulated?: boolean;
  data_quality?: number; current_rotation?: RotationStrategy | null;
  alternatives?: RotationStrategy[]; [key: string]: unknown;
};

function rotationText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(rotationText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.reason === 'string') return o.reason;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.direction === 'string') return `${String(o.component ?? 'Factor')}: ${o.direction}`;
    return Object.entries(o).map(([k,v]) => `${k}: ${rotationText(v)}`).join(' · ');
  }
  return value == null ? '' : String(value);
}

// Sequence-aware agronomic explanation based on the crops and returned score components.
// This is an interpretation of crop traits, not a measured soil-health outcome.
const ROTATION_CROP_TRAITS: Record<string, { family: string; label: string; note: string }> = {
  rice: { family: 'Poaceae', label: 'rice', note: 'Rice introduces substantial water demand, making irrigation availability and seasonal fit important.' },
  wheat: { family: 'Poaceae', label: 'wheat', note: 'Wheat provides a cool-season cereal phase, subject to suitable temperature and planting conditions.' },
  maize: { family: 'Poaceae', label: 'maize', note: 'Maize introduces a nutrient-demanding cereal phase that benefits from deliberate nutrient management.' },
  sorghum: { family: 'Poaceae', label: 'sorghum', note: 'Sorghum offers comparatively strong drought tolerance, which may support performance under water-limited conditions.' },
  mungbean: { family: 'Fabaceae', label: 'mungbean', note: 'Mungbean is a nitrogen-fixing legume that may support soil nitrogen cycling when appropriately managed.' },
  lentil: { family: 'Fabaceae', label: 'lentil', note: 'Lentil is a nitrogen-fixing legume that may contribute to soil nitrogen cycling and crop diversification.' },
  soybean: { family: 'Fabaceae', label: 'soybean', note: 'Soybean is a nitrogen-fixing legume; its potential nitrogen contribution depends on nodulation, harvest and residue management.' },
  mustard: { family: 'Brassicaceae', label: 'mustard', note: 'Mustard introduces a brassica phase, broadening the botanical families represented in the sequence.' },
  potato: { family: 'Solanaceae', label: 'potato', note: 'Potato introduces a tuber phase, with soil structure and water management important for crop performance.' },
};

function rotationCropIds(strategy: RotationStrategy): string[] {
  return (strategy.crop_ids?.length ? strategy.crop_ids : strategy.crop_names || [])
    .map(crop => crop.trim().toLowerCase());
}

function rotationStrategyExplanation(strategy: RotationStrategy): string {
  const ids = rotationCropIds(strategy);
  const unique = [...new Set(ids)];
  const notes: string[] = [];

  const legumes = unique.filter(id => ['mungbean', 'lentil', 'soybean'].includes(id));
  if (legumes.length) {
    const labels = legumes.map(id => ROTATION_CROP_TRAITS[id]?.label || id).join(' and ');
    notes.push(`${labels.charAt(0).toUpperCase() + labels.slice(1)} ${legumes.length === 1 ? 'is a nitrogen-fixing legume' : 'are nitrogen-fixing legumes'} that can support soil nitrogen cycling and long-term fertility when appropriately managed.`);
  }

  if (unique.includes('sorghum')) {
    notes.push('Drought-tolerant sorghum can support rotation resilience and help manage water-limited growing conditions.');
  }

  // Cover-crop use and deep-rooting benefits require verified management/trait
  // information. Crop names alone do not establish either characteristic.
  const coverCrops = (strategy as RotationStrategy & { cover_crop_ids?: string[] }).cover_crop_ids || [];
  if (coverCrops.some(id => ids.includes(id.toLowerCase()))) {
    notes.push('Cover-crop phases can protect soil from erosion and contribute organic matter when residues are retained.');
  }
  const deepRooted = (strategy as RotationStrategy & { deep_rooted_crop_ids?: string[] }).deep_rooted_crop_ids || [];
  if (deepRooted.some(id => ids.includes(id.toLowerCase()))) {
    notes.push('Deep-rooting crops can improve access to deeper soil moisture and nutrients and contribute to soil structure.');
  }

  const familyChanges = ids.slice(1).filter((id, i) => {
    const prev = ROTATION_CROP_TRAITS[ids[i]];
    const next = ROTATION_CROP_TRAITS[id];
    return prev && next && prev.family !== next.family;
  }).length;
  if (familyChanges > 0) {
    notes.push('Alternating botanical families supports crop diversity and may help manage crop-specific pest pressure.');
  } else if (ids.length > 1) {
    notes.push('Repeated botanical families make crop-specific pest and disease management particularly important.');
  }

  if (unique.includes('rice')) {
    notes.push('Rice phases require careful water management.');
  } else if (unique.includes('maize')) {
    notes.push('Maize phases benefit from balanced nutrient management.');
  }

  const score = strategy.score;
  const components: Array<[string, number | undefined]> = [
    ['crop suitability', score?.suitability],
    ['water impact', score?.water_impact],
    ['soil impact', score?.soil_impact],
    ['climate resilience', score?.resilience],
    ['yield index', score?.yield_score],
  ];
  const valid = components.filter((item): item is [string, number] =>
    typeof item[1] === 'number' && Number.isFinite(item[1]));
  if (valid.length) {
    const strongest = [...valid].sort((a, b) => b[1] - a[1])[0];
    notes.push(`Rotation scoring considers crop suitability, water, soil, resilience and yield indicators; ${strongest[0]} is the strongest component (${strongest[1].toFixed(1)}/100).`);
  }

  return notes.slice(0, 4).join(' ') || 'This crop sequence is assessed for field suitability, water requirements, soil impact and climate resilience.';
}

function rotationStrategyRisks(strategy: RotationStrategy): string {
  const apiRisks = [strategy.warnings, strategy.risks, strategy.limitations]
    .map(rotationText).filter(text => text.trim().length > 0);
  if (apiRisks.length) return [...new Set(apiRisks)].join(' · ');

  const ids = rotationCropIds(strategy);
  const risks: string[] = [];
  for (let i = 1; i < ids.length; i++) {
    const previous = ROTATION_CROP_TRAITS[ids[i - 1]];
    const current = ROTATION_CROP_TRAITS[ids[i]];
    if (previous && current && previous.family === current.family) {
      risks.push('Adjacent crops from the same botanical family may sustain crop-specific pest and disease pressure.');
      break;
    }
  }
  if (ids.includes('rice')) risks.push('Rice may require substantial water availability and season-specific management.');
  if (ids.includes('maize')) risks.push('Maize nutrient demand should be considered in the fertilizer plan.');
  return risks.length ? risks.join(' ') : 'No specific risks identified by the current assessment; local seasonal and management constraints still require review.';
}

function PersonalRotationPlanner() {
  const farm = useFarm();
  const fieldId = farm.selectedFieldId;
  const [priorities, setPriorities] = useState<RotationPriorities>({
    water: 0.5, yield_potential: 0.5, soil_health: 0.5, risk: 0.5,
  });
  const [result, setResult] = useState<PersonalRotationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setResult(null); setError(''); setSelected([]);
    setComparison(false); setExpanded(null);
  }, [fieldId]);

  // Presets express farmer preferences; the backend applies its own scoring weights.
  const priorityPresets: Array<{label: string; values: RotationPriorities; description: string}> = [
    { label: 'Save Water', values: {water: 0.9, soil_health: 0.35, risk: 0.55, yield_potential: 0.25}, description: 'Emphasize lower-water-demand crop options.' },
    { label: 'Improve Soil', values: {water: 0.35, soil_health: 0.9, risk: 0.5, yield_potential: 0.3}, description: 'Emphasize modeled soil-health factors.' },
    { label: 'Reduce Risk', values: {water: 0.5, soil_health: 0.4, risk: 0.9, yield_potential: 0.3}, description: 'Emphasize crop diversity and modeled resilience.' },
    { label: 'Balanced', values: {water: 0.5, soil_health: 0.5, risk: 0.5, yield_potential: 0.5}, description: 'Give all four preferences equal input values.' },
  ];
  const [activePreset, setActivePreset] = useState<string>('Balanced');
  const updatePriority = (key: keyof RotationPriorities, value: number) => {
    setActivePreset('Custom');
    setPriorities(prev => ({ ...prev, [key]: value / 100 }));
  };
  const applyPreset = (label: string, values: RotationPriorities) => {
    setActivePreset(label);
    setPriorities({...values});
  };
  const generate = async () => {
    if (!fieldId || loading) return;
    setLoading(true); setError(''); setResult(null); setComparison(false);
    setSelected([]); setExpanded(null);
    try {
      const response = await api.getPersonalRotations(fieldId, priorities);
      setResult(response as PersonalRotationResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate rotations.');
    } finally { setLoading(false); }
  };

  const strategies: RotationStrategy[] = result
    ? [...(result.current_rotation ? [result.current_rotation] : []), ...(result.alternatives || [])]
    : [];
  const strategyKey = (s: RotationStrategy, index: number) =>
    s.strategy_id || `${s.strategy_type || 'alternative'}-${index}-${(s.crop_ids || []).join('-')}`;
  const selectedStrategies = strategies.filter((s, i) => selected.includes(strategyKey(s, i)));
  const scoreValue = (value: unknown, normalized = true) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not assessed';
    return `${(normalized ? value * 100 : value).toFixed(1)} / 100`;
  };

  const renderStrategy = (s: RotationStrategy, index: number, inCompare = false) => {
    const key = strategyKey(s, index);
    const isCurrent = s.strategy_type === 'current' || (result?.current_rotation === s);
    const detailsOpen = expanded === key;
    const score = s.score;
    const rows: Array<[string, unknown]> = [
      ['Crop suitability', score?.suitability],
      ['Water impact (modeled)', score?.water_impact],
      ['Soil impact (modeled)', score?.soil_impact],
      ['Climate resilience (modeled)', score?.resilience],
      ['Yield index (modeled)', score?.yield_score],
    ];
    return (
      <article key={key} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 space-y-4 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`inline-block rounded px-2 py-1 text-xs font-semibold mb-2 ${isCurrent ? 'bg-amber-100 text-amber-900' : 'bg-primary/10 text-primary'}`}>
                {isCurrent ? 'Existing rotation · farmer history' : 'Alternative strategy'}
              </span>
              <h3 className="font-display text-xl font-semibold break-words">{s.title || (s.crop_names || []).join(' → ') || 'Rotation strategy'}</h3>
            </div>
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-center">
              <div className="font-bold text-xl text-primary">{typeof score?.total === 'number' ? score.total.toFixed(1) : '—'}</div>
              <div className="text-[10px] text-muted-foreground">Heuristic score</div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Crop sequence</div>
            <div className="flex flex-wrap gap-2 items-center">
              {(s.crop_names || s.crop_ids || []).map((crop, i) => (
                <React.Fragment key={`${crop}-${i}`}>
                  {i > 0 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">{crop}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* UI-only sample calendar. These dates are illustrative, not agronomic advice. */}
          <section className="rounded-lg border border-[#dce7df] bg-[#f5f8f5] p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold">Rotation timeline</h4>
              </div>
              <span className="rounded-md border border-primary/30 bg-white px-3 py-1.5 text-primary" aria-hidden="true">
                <CalendarDays className="h-4 w-4" />
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(s.crop_names || s.crop_ids || []).map((crop, i) => {
                const names = (s.crop_ids?.length ? s.crop_ids : s.crop_names || []).map(name => name.toLowerCase()).join('-');
                const sampleDates: Record<string, string[]> = {
                  'sorghum-maize-soybean': ["Jan–May '27", "Jun–Oct '27", "Nov '27–Mar '28"],
                  'mungbean-sorghum-mungbean': ["Jan–Mar '27", "Apr–Aug '27", "Sep–Nov '27"],
                  'sorghum-mungbean-sorghum': ["Jan–May '27", "Jun–Aug '27", "Sep '27–Jan '28"],
                };
                const dates = sampleDates[names] || ["Jan–Apr '27", "May–Aug '27", "Sep–Dec '27"];
                return (
                  <React.Fragment key={`${key}-demo-${i}`}>
                    {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-[#648375]" />}
                    <div className="min-w-[95px] flex-1 rounded-lg border border-[#a9c2b5] bg-white px-2 py-3 text-center shadow-sm">
                      <div className="text-[11px] font-semibold text-[#245443]">{dates[i] || 'Demo period'}</div>
                      <div className="mt-1 text-xs font-semibold text-[#18392d]">{crop}</div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </section>
          <div className="space-y-3 pt-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-sm border-b border-border/50 pb-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-right">{scoreValue(value)}</span>
              </div>
            ))}
          </div>
          {(detailsOpen || inCompare) && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-sm">
              <div><strong>Explanation</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{rotationStrategyExplanation(s)}</p></div>
              <div><strong>Risks / limitations</strong><p className="mt-1 text-muted-foreground">{rotationStrategyRisks(s)}</p></div>
            </div>
          )}
        </div>
        {!inCompare && <div className="border-t border-border p-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setExpanded(detailsOpen ? null : key)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">{detailsOpen ? 'Hide explanation' : 'Why this strategy?'}</button>
          <button type="button" onClick={() => setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${selected.includes(key) ? 'bg-primary text-primary-foreground' : 'border border-primary/30 text-primary hover:bg-primary/5'}`}>
            {selected.includes(key) ? 'Selected for comparison' : 'Add to compare'}
          </button>
        </div>}
      </article>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground mb-2">{farm.farmName} / {farm.selectedField?.name || 'No field selected'}</p>
        <h2 className="font-display text-3xl font-semibold">Rotation Planner</h2>
        <p className="text-muted-foreground mt-2">Compare crop sequences using your field details, available NASA observations, and farmer priorities.</p>
      </header>
      {!fieldId ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">Add or select a personal field before generating rotations.</div> : (
        <>
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
              <h3 className="text-lg font-semibold">What matters most to you?</h3>
              <button type="button" onClick={() => applyPreset('Balanced', {water:0.5,yield_potential:0.5,soil_health:0.5,risk:0.5})} className="text-sm text-primary hover:underline">Reset priorities</button>
            </div>
            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick suggestions</p>
              <div className="flex flex-wrap gap-2">
                {priorityPresets.map(preset => (
                  <button key={preset.label} type="button"
                    onClick={() => applyPreset(preset.label, preset.values)}
                    aria-pressed={activePreset === preset.label}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${activePreset === preset.label ? 'border-[#174D3B] bg-[#174D3B] text-white' : 'border-border bg-[#f1eee8] text-[#4d514d] hover:border-[#174D3B]/50 hover:bg-[#e8efe9]'}`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {priorityPresets.find(p => p.label === activePreset)?.description || 'Custom preferences: adjust any slider below.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {([
                ['water','Water saving'], ['soil_health','Soil health'],
                ['risk','Climate resilience'], ['yield_potential','Yield potential'],
              ] as Array<[keyof RotationPriorities,string]>).map(([key,label]) => (
                <label key={key} className="block">
                  <div className="flex justify-between text-sm font-medium mb-2"><span>{label}</span><span>{Math.round(priorities[key]*100)}%</span></div>
                  <input type="range" min="0" max="100" step="5" value={Math.round(priorities[key]*100)} onChange={e => updatePriority(key, Number(e.target.value))} className="w-full accent-[#174D3B]" />
                  <p className="mt-1 text-xs text-muted-foreground">{key === 'water' ? 'Greater preference for lower-water-demand rotations.' : key === 'soil_health' ? 'Greater preference for modeled soil-health factors.' : key === 'risk' ? 'Greater preference for diversity and resilience heuristics.' : 'Greater preference for the available yield-potential index.'}</p>
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Each slider is an independent preference strength (0–100%), not a share of a 100% total or a guaranteed outcome. The backend normalizes scoring weights separately.</p>
            <div className="mt-6 flex flex-wrap gap-3 items-center">
              <button type="button" onClick={() => void generate()} disabled={loading} className="rounded-lg bg-primary text-primary-foreground px-6 py-3 font-semibold disabled:opacity-60 hover:bg-primary/90">
                {loading ? 'Analyzing field…' : result ? 'Regenerate with priorities' : 'Generate Rotation Strategies'}
              </button>
              <span className="text-xs text-muted-foreground">Planning scores use current/historical conditions; future seasons are not forecast.</span>
            </div>
          </section>
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
          {loading && <PageLoader />}
          {result && !loading && <>
            <div className="rounded-xl border border-border bg-card p-4 text-sm flex flex-wrap gap-4">
              <span><strong>Observation source:</strong> {result.data_source || 'Not reported'}</span>
              <span><strong>Data quality:</strong> {typeof result.data_quality === 'number' ? `${(result.data_quality*100).toFixed(1)}% (API indicator)` : 'Not reported'}</span>
              <span><strong>Simulation:</strong> {result.simulated ? 'Yes' : 'No'}</span>
            </div>
            {!result.current_rotation && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Existing rotation unavailable.</strong> {typeof result.history_message === 'string' ? result.history_message : 'This field does not have enough usable crop history to construct a comparable current-rotation baseline.'} Alternatives below are not a comparison against the existing rotation.
            </div>}
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-display text-2xl font-semibold">{strategies.length} Available Strategies</h3>
              <button type="button" disabled={selected.length < 2} onClick={() => setComparison(v => !v)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-40">
                {comparison ? 'Back to strategies' : `Compare ${selected.length} selected`}
              </button>
            </div>
            {strategies.length === 0 && <p className="rounded-xl border border-border bg-card p-6">No rotation strategies returned. Review the field data and try again.</p>}
            {comparison ? <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">{selectedStrategies.map(s => renderStrategy(s, strategies.indexOf(s), true))}</div>
              : <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">{strategies.map((s,i) => renderStrategy(s,i))}</div>}
            <section className="rounded-xl border border-border bg-card p-5 md:p-7 shadow-sm">
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Field Condition Insights</h3>
                <p className="mt-1 text-sm text-muted-foreground">Seasonal planning considerations for crop rotations</p>
              </div>
              <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
                <div>
                  <Sprout className="mb-3 h-5 w-5 text-emerald-600" />
                  <h4 className="text-base font-semibold">Bare-field window</h4>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">Dec–Jan</p>
                  <p className="mt-1 text-sm text-muted-foreground">Potential opportunity for a short-duration crop.</p>
                </div>
                <div>
                  <ThermometerSun className="mb-3 h-5 w-5 text-orange-600" />
                  <h4 className="text-base font-semibold">Crop vulnerability</h4>
                  <p className="mt-2 text-2xl font-semibold text-orange-600">Elevated</p>
                  <p className="mt-1 text-sm text-muted-foreground">Potential heat and water stress during dry months.</p>
                </div>
                <div>
                  <Droplets className="mb-3 h-5 w-5 text-blue-600" />
                  <h4 className="text-base font-semibold">Water availability</h4>
                  <p className="mt-2 text-2xl font-semibold text-foreground">Limited</p>
                  <p className="mt-1 text-sm text-muted-foreground">Consider lower-water crop alternatives.</p>
                </div>
                <div>
                  <Sprout className="mb-3 h-5 w-5 text-emerald-600" />
                  <h4 className="text-base font-semibold">Rotation opportunity</h4>
                  <p className="mt-2 text-2xl font-semibold text-foreground">Available</p>
                  <p className="mt-1 text-sm text-muted-foreground">Consider changing crop families to disrupt pest cycles.</p>
                </div>
              </div>
            </section>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong>Interpretation:</strong> NASA observations inform environmental inputs. Rotation rankings are heuristic, not NASA-issued recommendations. Crop-season feasibility and future yield/soil changes require independent validation. Consult local agronomic advice before planting.
            </div>
          </>}
        </>
      )}
    </div>
  );
}

// ─── Page 06: Rotation Planner ────────────────────────────────────────────────
function RotationPlanner() {
  const farm = useFarm();
  const { data: baseData, fieldId } = useApiFetch<any>('/api/rotations-mock');
  const [waterSaving, setWaterSaving] = useState(40);
  const [soilHealth, setSoilHealth] = useState(30);
  const [climateResilience, setClimateResilience] = useState(20);
  const [yieldProd, setYieldProd] = useState(10);
  const [generationStep, setGenerationStep] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [whyScenario, setWhyScenario] = useState<string|null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState(['Sorghum','Soybean','Cover Crop']);
  const [scenarios, setScenarios] = useState<any[]>([]);

  const availableCrops = baseData?.available_crops || [];
  const baseScenarios = baseData?.scenarios || [];

  useEffect(() => { if (baseScenarios.length) setScenarios(baseScenarios); }, [baseData]);

  const toggleCrop = (name: string) => setSelectedCrops(prev => prev.includes(name) ? prev.filter(c=>c!==name) : [...prev,name]);
  const toggleCompare = (name: string) => setSelectedForCompare(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev,name]);
  const applyPreset = (w:number,s:number,c:number,y:number) => { setWaterSaving(w);setSoilHealth(s);setClimateResilience(c);setYieldProd(y); };

  const handleGenerate = async () => {
    setGenerationStep(1);
    try {
      const result = await api.generateRotations({
        water_saving: waterSaving, soil_health: soilHealth,
        climate_resilience: climateResilience, yield_productivity: yieldProd,
      }, fieldId);
      setScenarios(result.scenarios || baseScenarios);
    } catch { setScenarios(baseScenarios); }
    setGenerationStep(2);
  };

  const whyTexts: Record<string, string> = {};
  scenarios.forEach((s: any) => { whyTexts[s.name] = s.why || ''; });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 relative overflow-x-hidden">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
          {farm.farmName} <ChevronRight className="w-3 h-3" /> {baseData?.field || farm.selectedField?.name} <ChevronRight className="w-3 h-3" /> {baseData?.area_ha ?? farm.selectedField?.area_ha ?? '—'} ha <ChevronRight className="w-3 h-3" /> Current: {baseData?.current_crop || farm.selectedField?.crop || '—'}
        </div>
        <h2 className="font-display text-3xl font-semibold mb-1">Rotation Planner</h2>
        <p className="text-muted-foreground text-lg">Explore crop rotations based on your field conditions and priorities.</p>
      </header>

      {generationStep === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-lg mb-6">What matters most to you?</h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={()=>applyPreset(60,20,10,10)} className="text-[10px] uppercase font-bold text-muted-foreground bg-muted hover:bg-border px-2 py-1 rounded transition-colors">Save Water</button>
                <button onClick={()=>applyPreset(10,60,20,10)} className="text-[10px] uppercase font-bold text-muted-foreground bg-muted hover:bg-border px-2 py-1 rounded transition-colors">Improve Soil</button>
                <button onClick={()=>applyPreset(10,20,60,10)} className="text-[10px] uppercase font-bold text-muted-foreground bg-muted hover:bg-border px-2 py-1 rounded transition-colors">Reduce Risk</button>
                <button onClick={()=>applyPreset(25,25,25,25)} className="text-[10px] uppercase font-bold text-muted-foreground bg-muted hover:bg-border px-2 py-1 rounded transition-colors">Balanced</button>
              </div>
              <div className="space-y-6">
                <PrioritySlider label="Water Saving" value={waterSaving} setValue={setWaterSaving} color="bg-water" desc="Gives greater weight to lower-water-demand rotations." />
                <PrioritySlider label="Soil Health" value={soilHealth} setValue={setSoilHealth} color="bg-[#8a6c52]" desc="Gives greater weight to soil-building and diverse rotations." />
                <PrioritySlider label="Climate Resilience" value={climateResilience} setValue={setClimateResilience} color="bg-primary" desc="Gives greater weight to climate-tolerant crop characteristics." />
                <PrioritySlider label="Yield / Productivity" value={yieldProd} setValue={setYieldProd} color="bg-accent" desc="Gives greater weight to productivity-related factors." />
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <button onClick={()=>setShowAdvanced(!showAdvanced)} className="w-full flex justify-between items-center p-4 font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
                Advanced Inputs {showAdvanced ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showAdvanced && (
                <div className="p-4 border-t border-border bg-muted/10 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Planning horizon</span><span className="font-medium">4 years</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Soil profile</span><span className="font-medium">{baseData?.soil || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Irrigation</span><span className="font-medium">{baseData?.irrigation || '—'}</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-semibold text-lg">Candidate crops</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableCrops.map((c: any) => (
                <SelectableCrop key={c.name} name={c.name} water={c.water} climate={c.climate} soil={c.soil} duration={c.duration} selected={selectedCrops.includes(c.name)} onToggle={()=>toggleCrop(c.name)} />
              ))}
            </div>
            <div className="pt-8">
              <button onClick={handleGenerate} className="w-full md:w-auto bg-primary text-primary-foreground font-display font-semibold text-lg py-4 px-12 rounded-xl hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2">
                Generate Rotation Scenarios <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {generationStep === 1 && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
          <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          <h3 className="font-display font-semibold text-2xl">Analyzing your field...</h3>
          <div className="text-sm text-muted-foreground space-y-2 text-left bg-card border border-border p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Reading field history</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Checking soil moisture</div>
            <div className="flex items-center gap-2 text-muted-foreground/50 animate-pulse"><CheckCircle2 className="w-4 h-4" /> Reviewing vegetation trends</div>
            <div className="flex items-center gap-2 text-muted-foreground/30"><CheckCircle2 className="w-4 h-4" /> Applying your priorities</div>
            <div className="flex items-center gap-2 text-muted-foreground/30"><CheckCircle2 className="w-4 h-4" /> Building rotation scenarios</div>
          </div>
        </div>
      )}

      {generationStep === 2 && !showComparison && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
            <h3 className="font-semibold text-xl">{scenarios.length} Rotation Scenarios Generated</h3>
            <div className="flex gap-3 items-center">
              {selectedForCompare.length > 0 && (
                <button onClick={()=>setShowComparison(true)} className="text-sm bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-all shadow-md">
                  Compare {selectedForCompare.length} Selected
                </button>
              )}
              <button onClick={()=>{setGenerationStep(0);setSelectedForCompare([]);}} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Edit Priorities
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {scenarios.map((s: any) => (
              <ScenarioCard key={s.name} name={s.name} desc={s.desc} timeline={s.timeline} water={s.water} soil={s.soil} climate={s.climate} div={s.div} yieldS={s.yieldS} overallScore={s.overallScore}
                onWhy={()=>setWhyScenario(s.name)} isComparing={selectedForCompare.includes(s.name)} onToggleCompare={()=>toggleCompare(s.name)} />
            ))}
          </div>
        </div>
      )}

      {showComparison && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
            <div>
              <h3 className="font-display font-semibold text-2xl">Compare Rotation Scenarios</h3>
              <p className="text-muted-foreground text-sm">See how the scenarios differ before saving a farm plan.</p>
            </div>
            <button onClick={()=>setShowComparison(false)} className="text-sm text-primary font-medium hover:underline flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back to Scenarios</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-x-auto pb-4">
            {scenarios.filter((s: any)=>selectedForCompare.includes(s.name) || selectedForCompare.length === 0).map((s: any) => (
              <ComparisonColumn key={s.name} name={s.name} desc={s.desc}
                timeline={s.timeline?.map((t: any)=>t.c).join(' → ') || ''}
                water={s.water} soil={s.soil} climate={s.climate} div={s.div} yieldS={s.yieldS}
                tradeoff={s.why?.slice(0,80) + '...' || 'Optimized rotation.'}
                onWhy={()=>setWhyScenario(s.name)} />
            ))}
          </div>
        </div>
      )}

      {whyScenario && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-card border-l border-border shadow-2xl z-[999] flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
            <h3 className="font-semibold text-lg">Why this scenario?</h3>
            <button onClick={()=>setWhyScenario(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">01 Field Conditions</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Soil moisture:</span><span className="font-semibold">{baseData?.field_conditions?.soil_moisture || '—'}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Rainfall:</span><span className="font-semibold">{baseData?.field_conditions?.rainfall || '—'}</span></div>
                <div className="flex justify-between border-b border-border/50 pb-2"><span className="text-muted-foreground">Water stress:</span><span className="font-semibold text-accent">{baseData?.field_conditions?.water_stress || '—'}</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">04 Farmer Priorities</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Water Saving:</span><span className="font-semibold">{waterSaving}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Soil Health:</span><span className="font-semibold">{soilHealth}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Climate:</span><span className="font-semibold">{climateResilience}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Yield:</span><span className="font-semibold">{yieldProd}%</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">05 Scenario Logic</h4>
              <div className="bg-primary/5 border border-primary/20 p-4 rounded text-sm text-foreground leading-relaxed">
                {whyTexts[whyScenario] || 'Recent rainfall is below the historical range and the field currently shows moderate water stress. This scenario places greater emphasis on lower-water-demand phases.'}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-4">Data Sources</h4>
              <div className="flex flex-wrap gap-2">
                {(baseData?.data_sources || ['NASA POWER']).map((s: string)=>(
                  <span key={s} className="bg-muted text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 rounded border border-border">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrioritySlider({ label, value, setValue, color, desc }: any) {
  return (
    <div className="group relative">
      <div className="flex justify-between text-sm font-semibold mb-2">
        <span className="text-foreground">{label}</span><span className="text-muted-foreground">{value}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        <div className={"h-full " + color} style={{width:value+'%'}}></div>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={(e)=>setValue(Number(e.target.value))} className="w-full opacity-0 -mt-2 h-4 cursor-pointer" />
      <div className="text-xs text-muted-foreground mt-2 leading-tight">{desc}</div>
    </div>
  );
}

function SelectableCrop({ name, water, climate, soil, duration, selected, onToggle }: any) {
  return (
    <div onClick={onToggle} className={"p-4 border rounded-xl cursor-pointer transition-all " + (selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm scale-[1.02]' : 'border-border bg-card hover:border-primary/30 hover:shadow')}>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-semibold text-lg">{name}</h4>
        <div className={"w-5 h-5 rounded border flex items-center justify-center transition-colors " + (selected ? 'bg-primary border-primary' : 'border-border bg-background')}>
          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground border-b border-border/50 pb-1"><span>Water Demand</span><span className="font-medium text-foreground">{water}</span></div>
        <div className="flex justify-between text-muted-foreground border-b border-border/50 pb-1"><span>Climate Sens.</span><span className="font-medium text-foreground">{climate}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Soil Impact</span><span className="font-medium text-foreground">{soil}</span></div>
      </div>
    </div>
  );
}

function ScenarioCard({ name, desc, timeline, water, soil, climate, div, yieldS, overallScore, onWhy, isComparing, onToggleCompare }: any) {
  const [hoveredCrop, setHoveredCrop] = useState<number|null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const cropDetails: Record<string,any> = {
    'Rice':{water:'High',soil:'Neutral'},'Wheat':{water:'Moderate',soil:'Neutral'},
    'Cover Crop':{water:'Low',soil:'Positive'},'Sorghum':{water:'Low',soil:'Neutral'},
    'Soybean':{water:'Moderate',soil:'Positive'},'Maize':{water:'Moderate',soil:'Neutral'},
    'Lentil':{water:'Low',soil:'Positive'},
  };
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-visible hover:shadow-md transition-shadow relative">
      <div className="p-6 pb-0">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-display text-2xl font-bold text-foreground">{name}</h4>
          <div className="flex flex-col items-center justify-center bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 shrink-0 ml-2">
            <span className="text-2xl font-bold text-primary leading-none">{overallScore}</span>
            <span className="text-[8px] uppercase text-primary/80 font-bold tracking-wider mt-0.5">Fit Score</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6 h-10">{desc}</p>
        <div className="mb-6 relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border z-0"></div>
          <div className="space-y-4 relative z-10">
            {(timeline || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 relative group cursor-pointer" onMouseEnter={()=>setHoveredCrop(i)} onMouseLeave={()=>setHoveredCrop(null)}>
                <div className={"px-2 h-8 rounded-lg border-2 flex flex-col items-center justify-center shrink-0 transition-colors z-20 min-w-[75px] " + (hoveredCrop===i?'bg-primary border-primary text-primary-foreground shadow-md':'bg-card border-primary text-foreground')}>
                  <div className="text-[9px] font-bold whitespace-nowrap">{item.p}</div>
                </div>
                <div className={"px-3 py-1.5 rounded font-medium text-sm border transition-all z-20 " + (hoveredCrop===i?'bg-primary/10 border-primary/30 shadow-sm text-primary':'bg-muted border-border')}>
                  {item.c} {i===0 && <span className="text-xs text-muted-foreground font-normal ml-1">(Current)</span>}
                </div>
                {hoveredCrop===i && (
                  <div className="absolute left-20 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl p-3 z-[100]">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 border-b border-border/50 pb-1">{item.c} Impact</div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Water Need:</span><span className="font-medium">{cropDetails[item.c]?.water||'Unknown'}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Soil Benefit:</span><span className="font-medium">{cropDetails[item.c]?.soil||'Unknown'}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-muted/30 border-t border-border p-6 space-y-1">
        <div className="flex items-center gap-2 mb-2"><span className="text-[10px] uppercase font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">Modeled Score Breakdown</span></div>
        <ScoreBar label="Water" val={water} color="bg-water" />
        <ScoreBar label="Soil" val={soil} color="bg-[#8a6c52]" />
        <ScoreBar label="Climate" val={climate} color="bg-primary" />
        <ScoreBar label="Diversity" val={div} color="bg-accent" />
        <ScoreBar label="Yield" val={yieldS} color="bg-primary" />
      </div>
      <div className="p-4 border-t border-border bg-card flex flex-col gap-2 mt-auto rounded-b-xl z-10 relative">
        <div className="flex gap-2">
          <button className="group flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center overflow-hidden">
            <span className="transform group-hover:-translate-x-1 transition-transform duration-300">View Scenario</span>
            <ArrowRight className="w-4 h-4 opacity-0 -mr-4 group-hover:opacity-100 group-hover:mr-0 transition-all duration-300 absolute right-4" />
          </button>
          <button onClick={onWhy} className="flex-1 bg-card text-foreground py-2 rounded-lg font-medium text-sm hover:bg-muted border border-border transition-colors shadow-sm">Why this scenario?</button>
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={onToggleCompare} className={`flex-1 py-1.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 rounded-md ${isComparing?'bg-primary/10 text-primary border border-primary/20':'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'}`}>
            {isComparing ? <><CheckCircle2 className="w-3.5 h-3.5"/> Selected</> : 'Compare'}
          </button>
          <button onClick={()=>setIsSaved(!isSaved)} className={`flex-1 py-1.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 rounded-md ${isSaved?'bg-accent/10 text-accent border border-accent/20':'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'}`}>
            {isSaved ? <><CheckCircle2 className="w-3.5 h-3.5"/> Saved</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, val, color }: any) {
  return (
    <div className="group hover:bg-muted/60 p-1 -mx-1 rounded transition-colors cursor-default">
      <div className="flex justify-between text-xs font-medium mb-1">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span><span className="text-foreground">{val}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={"h-full " + color} style={{width:val+'%'}}></div>
      </div>
    </div>
  );
}

function ComparisonColumn({ name, desc, timeline, water, soil, climate, div, yieldS, tradeoff, onWhy }: any) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col min-w-[300px]">
      <div className="p-6 border-b border-border"><h4 className="font-display text-xl font-bold mb-1">{name}</h4><p className="text-sm text-muted-foreground h-10">{desc}</p></div>
      <div className="p-6 border-b border-border bg-muted/20">
        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Timeline <span className="bg-background border border-border px-1.5 rounded ml-1">Illustrative</span></div>
        <div className="text-sm font-medium text-foreground">{timeline}</div>
      </div>
      <div className="p-6 border-b border-border space-y-4 flex-1">
        <ScoreBar label="Water Demand" val={water} color="bg-water" />
        <ScoreBar label="Soil Impact" val={soil} color="bg-[#8a6c52]" />
        <ScoreBar label="Climate Sens." val={climate} color="bg-primary" />
        <ScoreBar label="Crop Diversity" val={div} color="bg-accent" />
        <ScoreBar label="Yield Stability" val={yieldS} color="bg-primary" />
      </div>
      <div className="p-6 border-b border-border bg-primary/5">
        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Trade-offs</div>
        <p className="text-sm font-medium text-primary">{tradeoff}</p>
      </div>
      <div className="p-4 bg-card flex flex-col gap-2 rounded-b-xl">
        <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:bg-primary/90">View Scenario</button>
        <button onClick={onWhy} className="w-full bg-card text-foreground py-2 rounded-lg font-medium text-sm hover:bg-muted border border-border">Why this scenario?</button>
        <button className="w-full bg-card text-muted-foreground py-2 rounded-lg font-medium text-sm hover:text-foreground hover:bg-muted border border-border">Save Scenario</button>
      </div>
    </div>
  );
}

// ─── Page 07: Scenario Lab ────────────────────────────────────────────────────
type ScenarioWater = 'High' | 'Medium' | 'Low';
type ScenarioParameters = import('./api').PersonalScenarioParams;
type ScenarioStrategy = {
  name: string;
  crop_ids: string[];
  crop_names: string[];
  baseline_score: number;
  scenario_score: number;
  water_demand_mm: number;
  baseline_resilience_component?: number;
  scenario_resilience_component?: number;
};
type PersonalScenarioData = {
  field_id: string;
  field_name: string;
  data_source: string;
  period: { start: string; end: string };
  baseline: { rainfall_pct: number; rainfall_mm: number; temperature_c: number; root_zone_wetness_pct: number | null; resilience: number | null };
  scenario: { rainfall_pct: number; rainfall_mm: number; temperature_c: number; water_availability: ScenarioWater | number; effective_water_multiplier_pct: number; resilience: number | null };
  strategies: ScenarioStrategy[];
  chart_data: Array<{ case: string; 'Water Saver'?: number; 'Soil Builder'?: number; Balanced?: number }>;
  recommended_strategy: ScenarioStrategy;
  explanation: string;
  limitations: string[];
};

function ScenarioLab({ isDemo }: { isDemo: boolean }) {
  const { selectedFieldId } = useFarm();
  const [params, setParams] = useState<ScenarioParameters>({
    rainfall_pct: 0, temperature_delta: 0, water_availability: 'Medium', soil_recovery: 'Medium',
  });
  const [debouncedParams, setDebouncedParams] = useState<ScenarioParameters>(params);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedParams(params), 350);
    return () => window.clearTimeout(timer);
  }, [params]);
  const [visible, setVisible] = useState({ 'Water Saver': true, 'Soil Builder': true, Balanced: true });
  const [result, setResult] = useState<PersonalScenarioData | null>(null);
  const [demoResult, setDemoResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setDemoResult(null);
    setError('');
    if (!isDemo && !selectedFieldId) { setLoading(false); return; }
    setLoading(true);
    const request = isDemo
      ? api.simulateScenario({
          rainfall_pct: [0, -10, -20, -30].reduce((best, x) => Math.abs(x - debouncedParams.rainfall_pct) < Math.abs(best - debouncedParams.rainfall_pct) ? x : best, 0),
          temperature_delta: [0, 1, 2, 3].reduce((best, x) => Math.abs(x - debouncedParams.temperature_delta) < Math.abs(best - debouncedParams.temperature_delta) ? x : best, 0),
          water_availability: typeof debouncedParams.water_availability === 'number' ? (debouncedParams.water_availability >= 110 ? 'High' : debouncedParams.water_availability <= 85 ? 'Low' : 'Medium') : debouncedParams.water_availability,
          soil_recovery: typeof debouncedParams.soil_recovery === 'number' ? (debouncedParams.soil_recovery >= 70 ? 'High' : debouncedParams.soil_recovery <= 30 ? 'Low' : 'Medium') : debouncedParams.soil_recovery,
        }, selectedFieldId)
      : api.simulatePersonalScenario(selectedFieldId!, debouncedParams);
    request.then((data: any) => {
      if (cancelled) return;
      if (isDemo) setDemoResult(data);
      else if (data?.data_source === 'real' && data?.field_id === selectedFieldId) setResult(data as PersonalScenarioData);
      else setError('Verified NASA scenario results are unavailable for this field.');
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Scenario calculation failed.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isDemo, selectedFieldId, debouncedParams]);

  const setParameter = <K extends keyof ScenarioParameters>(key: K, value: ScenarioParameters[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setResult(null);
    setDemoResult(null);
  };
  const reset = () => setParams({ rainfall_pct: 0, temperature_delta: 0, water_availability: 'Medium', soil_recovery: 'Medium' });
  const fmt = (n: number | null | undefined, suffix = '') => typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}${suffix}` : 'Not assessed';
  const demoChart = (demoResult?.chart_data ?? []).map((row: any) => ({
    case: row.case ?? row.year ?? 'Scenario',
    'Water Saver': row.ws, 'Soil Builder': row.sb, Balanced: row.br,
  }));
  const chart = isDemo ? demoChart : (result?.chart_data ?? []);
  const baseline = isDemo ? demoResult?.baseline : result?.baseline;
  const scenario = isDemo ? demoResult?.scenario : result?.scenario;
  const waterPct = isDemo ? scenario?.water_availability_pct : scenario?.effective_water_multiplier_pct;
  const groups: Array<{
    label: string;
    key: keyof ScenarioParameters;
    min: number;
    max: number;
    step: number;
    unit: string;
    presets: Array<{ label: string; value: number | ScenarioWater }>;
  }> = [
    { label: 'Rainfall change', key: 'rainfall_pct', min: -100, max: 100, step: 1, unit: '%', presets: [
      { label: 'Historical', value: 0 }, { label: '-10%', value: -10 }, { label: '-20%', value: -20 }, { label: '-30%', value: -30 },
    ] },
    { label: 'Temperature change', key: 'temperature_delta', min: -10, max: 10, step: 0.1, unit: '°C', presets: [
      { label: 'Historical', value: 0 }, { label: '+1°C', value: 1 }, { label: '+2°C', value: 2 }, { label: '+3°C', value: 3 },
    ] },
    { label: 'Water availability assumption', key: 'water_availability', min: 0, max: 150, step: 1, unit: '%', presets: [
      { label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' },
    ] },
    { label: 'Soil recovery priority', key: 'soil_recovery', min: 0, max: 100, step: 1, unit: '%', presets: [
      { label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' },
    ] },
  ];
  const numericValue = (key: keyof ScenarioParameters): number => {
    const value = params[key];
    if (typeof value === 'number') return value;
    if (key === 'water_availability') return ({ Low: 70, Medium: 100, High: 110 } as const)[value as ScenarioWater];
    return ({ Low: 15, Medium: 35, High: 65 } as const)[value as ScenarioWater];
  };
  const names = ['Water Saver', 'Soil Builder', 'Balanced'] as const;
  const colors: Record<typeof names[number], string> = { 'Water Saver': '#4682b4', 'Soil Builder': '#8a6c52', Balanced: '#174D3B' };
  // Focus the vertical scale on the actual scores; never change the scores themselves.
  const plottedScores = chart.flatMap((row: any) => names.filter(name => visible[name]).map(name => row[name]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));
  const scoreMin = plottedScores.length ? Math.min(...plottedScores) : 0;
  const scoreMax = plottedScores.length ? Math.max(...plottedScores) : 100;
  const scorePadding = Math.max(1, (scoreMax - scoreMin) * 0.25);
  const scoreDomain: [number, number] = [Math.max(0, Math.floor(scoreMin - scorePadding)), Math.min(100, Math.ceil(scoreMax + scorePadding))];
  const scoreChanges = Object.fromEntries(names.map(name => {
    const base = chart.find((row: any) => row.case === 'Baseline')?.[name];
    const next = chart.find((row: any) => row.case === 'Scenario')?.[name];
    return [name, typeof base === 'number' && typeof next === 'number' ? next - base : null];
  })) as Record<typeof names[number], number | null>;

  // Explain the modeled result in plain language without changing the backend scores.
  const scenarioMessage = (() => {
    if (!isDemo && !result) return loading ? 'Calculating…' : 'Choose scenario parameters to compare rotations for the selected field.';
    if (isDemo && !demoResult) return loading ? 'Calculating…' : 'Demo scenario unavailable.';

    const rainChange = numericValue('rainfall_pct');
    const tempChange = numericValue('temperature_delta');
    const water = numericValue('water_availability');
    const soilPriority = numericValue('soil_recovery');
    const sentences: string[] = [];

    if (rainChange === 0) sentences.push('Rainfall stays at the historical level.');
    else if (rainChange < 0) sentences.push(`Rainfall is ${Math.abs(rainChange)}% lower, which could make water harder for crops to access.`);
    else sentences.push(`Rainfall is ${rainChange}% higher, which may provide more water for crops.`);

    if (tempChange > 0) sentences.push(`Warmer conditions (+${tempChange}°C) could increase crop water needs.`);
    else if (tempChange < 0) sentences.push(`Cooler conditions (${tempChange}°C) could reduce heat pressure on crops.`);
    else sentences.push('Temperature stays at the historical level.');

    if (water < 100) sentences.push(`The scenario assumes less available water (${water}% of normal).`);
    else if (water > 100) sentences.push(`The scenario assumes more available water (${water}% of normal).`);

    if (soilPriority >= 70) sentences.push('The comparison places stronger priority on soil recovery.');
    else if (soilPriority <= 30) sentences.push('The comparison places less priority on soil recovery.');

    if (!isDemo && result?.recommended_strategy) {
      const best = result.recommended_strategy;
      const change = best.scenario_score - best.baseline_score;
      const changeText = Math.abs(change) < 0.005
        ? 'Its modeled score stays about the same.'
        : change > 0
          ? `Its modeled score improves by ${change.toFixed(1)} points.`
          : `Its modeled score drops by ${Math.abs(change).toFixed(1)} points.`;
      sentences.push(`${best.name} ranks highest in this comparison. ${changeText}`);
    } else if (isDemo && demoResult?.explanation) {
      sentences.push('Compare the rotation scores above to see which option performs best in this demo.');
    }

    return sentences.join(' ');
  })();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 overflow-x-hidden">
      <header>
        <h2 className="font-display text-3xl font-semibold mb-1">Scenario Lab</h2>
        <p className="text-muted-foreground text-lg">Compare the same crop rotations under hypothetical environmental changes.</p>
        <p className="text-xs text-muted-foreground mt-2">{isDemo ? 'Demo Mode · illustrative data (custom inputs rounded to demo presets)' : `Personal Mode · ${result?.field_name ?? 'Selected field'} · NASA historical baseline, heuristic simulation`}</p>
      </header>
      {!isDemo && !selectedFieldId && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Select a saved field to run a personal scenario.</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-muted-foreground" role="status">Calculating scenario…</p>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
            <h3 className="font-semibold border-b border-border pb-2 text-sm uppercase tracking-wider">Parameters</h3>
            {groups.map(group => (
              <div className="space-y-3" key={group.key}>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={`scenario-${group.key}`} className="text-sm font-semibold">{group.label}</label>
                  <span className="text-sm font-bold text-primary">{numericValue(group.key)}{group.unit}</span>
                </div>
                <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-md border border-border">
                  {group.presets.map(option => (
                    <button type="button" key={String(option.value)}
                      onClick={() => setParameter(group.key, option.value as never)}
                      className={`flex-1 min-w-[55px] py-1.5 text-xs font-bold rounded ${params[group.key] === option.value ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <input id={`scenario-${group.key}`} type="range" min={group.min} max={group.max}
                  step={group.step} value={numericValue(group.key)}
                  onChange={event => setParameter(group.key, Number(event.target.value) as never)}
                  className="w-full cursor-pointer accent-[#174D3B]" />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{group.min}{group.unit}</span>
                  <label className="flex items-center gap-2">Custom
                    <input type="number" aria-label={`${group.label} custom value`}
                      min={group.min} max={group.max} step={group.step}
                      value={numericValue(group.key)}
                      onChange={event => {
                        if (event.target.value === '') return;
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) setParameter(group.key, Math.max(group.min, Math.min(group.max, value)) as never);
                      }}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
                  </label>
                  <span>{group.max}{group.unit}</span>
                </div>
              </div>
            ))}
            <button type="button" onClick={reset} className="w-full mt-4 bg-muted text-muted-foreground hover:bg-border font-semibold py-2 rounded-lg text-sm border border-border">Reset Scenario</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Baseline</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2"><span>Rainfall</span><strong>{baseline ? fmt(baseline.rainfall_mm, ' mm') : '—'}</strong></div>
                <div className="flex justify-between gap-2"><span>Temperature</span><strong>{baseline ? fmt(baseline.temperature_c, '°C') : '—'}</strong></div>
                <div className="flex justify-between gap-2"><span>Root wetness</span><strong>{baseline ? fmt(baseline.root_zone_wetness_pct, '%') : '—'}</strong></div>
              </div>
            </div>
            <div className="bg-primary/5 border-2 border-primary rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] uppercase font-bold px-2 py-1 rounded-bl-lg">Modeled</div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 border-b border-primary/20 pb-2">Scenario</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2"><span>Rainfall</span><strong>{scenario ? fmt(scenario.rainfall_mm, ' mm') : '—'}</strong></div>
                <div className="flex justify-between gap-2"><span>Temperature</span><strong>{scenario ? fmt(scenario.temperature_c, '°C') : '—'}</strong></div>
                <div className="flex justify-between gap-2"><span>Water assumption</span><strong>{waterPct == null ? '—' : typeof waterPct === 'number' ? `${waterPct}%` : String(waterPct)}</strong></div>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Baseline vs Scenario · Rotation scores</h3>
            <div className="flex flex-wrap gap-4 mt-3">
              {names.map(name => <label key={name} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={visible[name]} onChange={e => setVisible(prev => ({ ...prev, [name]: e.target.checked }))} />{name}
              </label>)}
            </div>
            {chart.length ? (
              <div className="h-[380px] w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 10, right: 24, left: 12, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="case" axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis axisLine={false} tickLine={false} domain={scoreDomain} allowDataOverflow={false} tickFormatter={value => Number(value).toFixed(0)} width={46} tickMargin={8} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        const score = Number(value);
                        const delta = scoreChanges[String(name) as typeof names[number]];
                        return [Number.isFinite(score) ? `${score.toFixed(2)} / 100${delta == null ? '' : ` (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`}` : '—', String(name)];
                      }}
                    />
                    {names.map(name => visible[name] && <Line key={name} type="linear" dataKey={name} name={name} stroke={colors[name]} strokeWidth={3} dot={{ r: 5 }} connectNulls={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[380px] flex items-center justify-center text-sm text-muted-foreground">{loading ? 'Loading comparison…' : 'No verified scenario comparison available.'}</div>}
            {chart.length > 0 && <p className="text-xs text-muted-foreground mt-2">Y-axis zooms to the observed score range for readability. Differences are actual backend values, not amplified scores.</p>}
            {!isDemo && result && <p className="text-xs text-muted-foreground mt-3">Observation period: {result.period.start} to {result.period.end}. Scores are heuristic, not future-year predictions.</p>}
          </div>
          {!isDemo && result?.strategies?.length ? (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-3">Compared rotations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.strategies.map(strategy => <div key={strategy.name} className="border border-border rounded-lg p-3 text-sm">
                  <div className="font-semibold">{strategy.name}</div>
                  <p className="text-xs text-muted-foreground my-2">{strategy.crop_names.join(' → ')}</p>
                  <div>Baseline: <strong>{strategy.baseline_score.toFixed(1)}</strong></div>
                  <div>Scenario: <strong>{strategy.scenario_score.toFixed(1)}</strong></div>
                  <div className="mt-1 text-xs text-muted-foreground">Change: <strong>{strategy.scenario_score - strategy.baseline_score >= 0 ? '+' : ''}{(strategy.scenario_score - strategy.baseline_score).toFixed(2)} points</strong></div>
                </div>)}
              </div>
              <p className="text-sm mt-4">Highest modeled score: <strong>{result.recommended_strategy.name}</strong> ({result.recommended_strategy.scenario_score.toFixed(1)}/100)</p>
            </div>
          ) : null}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> What changed?</h3>
            <div className="bg-muted/50 border border-border p-4 rounded-lg text-sm leading-relaxed">
              {scenarioMessage}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page 08: Climate Insights ────────────────────────────────────────────────
// Personal mode uses authenticated, field-specific NASA observations.
// Demo mode uses the existing demo endpoint, never a fabricated fallback.
type ClimateMetric = 'rain' | 'temperature' | 'soil_moisture' | 'ndvi';
const CLIMATE_MONTHS: Record<string, number> = { '7D': 7, '30D': 30, '3M': 90, '1Y': 365 };

function ClimateInsights({ isDemo }: { isDemo: boolean }) {
  const farm = useFarm();
  const [timeRange, setTimeRange] = useState('30D');
  const [metric, setMetric] = useState<ClimateMetric>('rain');
  const [refreshKey, setRefreshKey] = useState(0);
  const [personalData, setPersonalData] = useState<import('./api').PersonalClimateInsightsResponse | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const demo = useApiFetch<any>(isDemo ? '/api/climate-insights' : '');
  const [demoMetric, setDemoMetric] = useState('');

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    setPersonalData(null);
    setPersonalError('');
    if (!farm.selectedFieldId) { setPersonalLoading(false); return; }
    setPersonalLoading(true);
    api.getPersonalClimateInsights(farm.selectedFieldId, refreshKey > 0)
      .then((result) => { if (!cancelled) setPersonalData(result); })
      .catch((error) => { if (!cancelled) setPersonalError(error instanceof Error ? error.message : 'Could not load climate observations.'); })
      .finally(() => { if (!cancelled) setPersonalLoading(false); });
    return () => { cancelled = true; };
  }, [isDemo, farm.selectedFieldId, refreshKey]);

  const data = personalData;
  const dates = Array.isArray(data?.daily?.dates) ? data.daily.dates.map(String) : [];
  const days = CLIMATE_MONTHS[timeRange] || 30;
  const lastDate = dates.length ? new Date(`${dates[dates.length - 1]}T00:00:00Z`) : null;
  const cutoff = lastDate ? new Date(lastDate.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10) : '';
  const indices = dates.map((day, index) => day >= cutoff ? index : -1).filter(index => index >= 0);
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > -90;
  const seriesValue = (key: string, index: number) => {
    const series = data?.daily?.[key as keyof import('./api').ClimateDailyData];
    const value = Array.isArray(series) ? series[index] : null;
    return valid(value) ? value : null;
  };
  const rows = indices.map(index => {
    const tmax = seriesValue('tmax', index);
    const tmin = seriesValue('tmin', index);
    const rain = seriesValue('rain', index);
    const moisture = seriesValue('soil_moisture', index);
    const ndvi = seriesValue('ndvi', index);
    return {
      date: dates[index],
      rain: rain,
      temperature: tmax !== null && tmin !== null ? (tmax + tmin) / 2 : null,
      soil_moisture: moisture !== null ? moisture * 100 : null,
      ndvi: ndvi,
    };
  });
  const observed = (key: ClimateMetric) => rows.map(row => row[key]).filter(valid);
  const rainValues = observed('rain');
  const tempValues = observed('temperature');
  const moistureValues = observed('soil_moisture');
  const ndviValues = observed('ndvi');
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const mean = (values: number[]) => values.length ? sum(values) / values.length : null;
  const format = (value: number | null, unit = '', digits = 1) => value === null ? '—' : `${value.toFixed(digits)}${unit}`;
  const latest = (values: number[]) => values.length ? values[values.length - 1] : null;
  const metricMeta: Record<
  ClimateMetric,
  { title: string; unit: string; color: string }
> = {
  rain: {
    title: 'Rainfall Trend',
    unit: 'mm',
    color: '#174D3B',
  },
  temperature: {
    title: 'Temperature Trend',
    unit: '°C',
    color: '#174D3B',
  },
  soil_moisture: {
    title: 'Root-zone Wetness Trend',
    unit: '%',
    color: '#174D3B',
  },
  ndvi: {
    title: 'Vegetation Index (NDVI)',
    unit: '',
    color: '#174D3B',
  },
};
  const cards: Array<{ key: ClimateMetric; label: string; value: string; description: string; icon: React.ReactNode }> = [
    { key: 'rain', label: 'Accumulated Rainfall', value: rows.length > 0 && rainValues.length === rows.length ? format(sum(rainValues), ' mm') : '—', description: `${rainValues.length} of ${rows.length} days observed`, icon: <CloudRain className="w-5 h-5" /> },
    { key: 'temperature', label: 'Mean Temperature', value: format(mean(tempValues), '°C'), description: `${tempValues.length} of ${rows.length} days observed`, icon: <ThermometerSun className="w-5 h-5" /> },
    { key: 'soil_moisture', label: 'Latest Root-zone Wetness', value: format(latest(moistureValues), '%'), description: `${moistureValues.length} of ${rows.length} days observed`, icon: <Droplets className="w-5 h-5" /> },
    { key: 'ndvi', label: 'Latest NDVI', value: format(latest(ndviValues), '', 3), description: `${ndviValues.length} of ${rows.length} days observed`, icon: <Leaf className="w-5 h-5" /> },
  ];
  const insights: string[] = [];
  if (rows.length > 0 && rainValues.length === rows.length) insights.push(`Observed rainfall totalled ${format(sum(rainValues), ' mm')} across ${rainValues.length} available days in this period.`);
  if (tempValues.length) insights.push(`Mean observed air temperature was ${format(mean(tempValues), '°C')} during the selected period.`);
  if (moistureValues.length >= 2) {
    const difference = moistureValues[moistureValues.length - 1] - moistureValues[0];
    insights.push(`Root-zone wetness ${Math.abs(difference) < 0.5 ? 'remained broadly stable' : difference > 0 ? 'increased' : 'decreased'} across the available observations (${format(moistureValues[0], '%')} to ${format(latest(moistureValues), '%')}).`);
  }
  if (ndviValues.length) insights.push(`The latest available vegetation index was ${format(latest(ndviValues), '', 3)}.`);
  // Preserve missing observations as gaps in the graph.
  const chartRows = rows;
  const availableChartPoints = observed(metric).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-1">Climate Insights</h2>
          <p className="text-muted-foreground text-lg">Environmental observations for {farm.selectedField?.name || 'your selected field'}.</p>
        </div>
        {!isDemo && <button type="button" onClick={() => setRefreshKey(v => v + 1)} disabled={!farm.selectedFieldId || personalLoading} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-50">Refresh observations</button>}
      </header>

      {isDemo ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-2">Demo Climate Insights</h3>
            <p className="text-sm text-muted-foreground">This is the demonstration dataset. Sign in and select a personal field to view its NASA observations.</p>
          </div>
          {demo.loading ? <PageLoader /> : !demo.data ? <p className="rounded-lg border border-border bg-card p-5">Demo climate insights are unavailable.</p> : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {(Array.isArray(demo.data.indicators) ? demo.data.indicators : []).map((item: any, index: number) => (
                  <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="text-sm text-muted-foreground">{item.title}</div>
                    <div className="font-display text-2xl font-semibold mt-2">{item.current ?? '—'}</div>
                    <div className="text-xs text-muted-foreground mt-2">{item.trend || ''}</div>
                  </div>
                ))}
              </div>
              {Array.isArray(demo.data.trend_chart) && demo.data.trend_chart.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="font-semibold mb-4">Demo Trend</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%"><LineChart data={demo.data.trend_chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Line dataKey="current" name="Demo observations" stroke="#174D3B" dot={false}/></LineChart></ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : !farm.selectedFieldId ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">Select or add a field to view climate observations.</div>
      ) : personalLoading ? <PageLoader /> : personalError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Unable to load climate insights: {personalError}</div>
      ) : !data || data.status !== 'available' || !['real', 'partial'].includes(data.source) ? (
        <div className="rounded-xl border border-border bg-card p-8">No climate observations available for this field.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-foreground">{data.source === 'real' ? 'Observed data' : data.source === 'partial' ? 'Partial observations' : 'Demo / fallback data'}</span>
              <span>{data.period.start} – {data.period.end}</span>
              <span>Source: {(data.sources || []).join(', ') || data.dataset}</span>
            </div>
            <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
              {Object.keys(CLIMATE_MONTHS).map(range => <button type="button" key={range} onClick={() => setTimeRange(range)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${timeRange === range ? 'bg-[#174D3B] text-white' : 'text-muted-foreground hover:bg-muted'}`}>{range}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map(card => (
              <button type="button" key={card.key} onClick={() => setMetric(card.key)} className={`rounded-xl border bg-card p-5 text-left shadow-sm transition-all ${metric === card.key ? 'border-[#174D3B] ring-1 ring-[#174D3B]/30' : 'border-border hover:border-[#174D3B]/40'}`}>
                <div className="flex justify-between items-center text-muted-foreground"><span className="text-sm font-medium">{card.label}</span><span className="text-[#174D3B]">{card.icon}</span></div>
                <div className="font-display text-3xl font-semibold mt-4">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-2">{card.description}</p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
              <div><h3 className="font-semibold text-lg">Trend Visualization ({timeRange})</h3><p className="text-sm text-muted-foreground">{metricMeta[metric].title} · Daily observations · {timeRange} · {availableChartPoints} available points</p></div>
              <span className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">{metricMeta[metric].unit || 'Index'}</span>
            </div>
            {availableChartPoints > 0 ? (
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 14, right: 20, bottom: 20, left: -10 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#777777' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} minTickGap={35} />
                    <YAxis tick={{ fontSize: 12, fill: '#777777' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={45} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', fontSize: 12 }}
                      formatter={(value: any) => [
                        `${Number(value).toFixed(metric === 'ndvi' ? 3 : 2)}${metricMeta[metric].unit}`,
                        'Current Observation',
                      ]}
                    />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={10} wrapperStyle={{ paddingTop: 20, fontSize: 13, color: '#174D3B' }} />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      name="Current Observation"
                      stroke="#174D3B"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5, fill: '#174D3B', stroke: '#ffffff', strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive
                      animationDuration={900}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No {metricMeta[metric].title.toLowerCase()} observations for this period.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Field Climate Summary</h3>
            {insights.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{insights.map((item, index) => <div key={index} className="rounded-lg border border-border bg-[#f7f8f5] p-4 text-sm leading-relaxed">{item}</div>)}</div> : <p className="text-sm text-muted-foreground">No observations are available for this period.</p>}
            <p className="text-xs text-muted-foreground mt-4">Values reflect available observations in the selected period. Missing measurements are excluded from calculations.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page 09: Alerts ──────────────────────────────────────────────────────────
function Alerts({ onNavigate: _onNavigate }: { onNavigate: (tab: string) => void }) {
  const farm = useFarm();
  const [category, setCategory] = useState('All');
  const [fieldFilter, setFieldFilter] = useState('All');
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  let cancelled = false;

  const loadAlerts = async () => {
    setLoading(true);
    setError('');

    try {
      // Get current authenticated Supabase session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      // Use the same backend base URL as the other API calls.
      const baseUrl = (
        import.meta.env.VITE_API_URL || 'http://localhost:8000'
      ).replace(/\/$/, '');

      const response = await fetch(`${baseUrl}/api/alerts`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Alerts request failed: ${response.status}`);
      }

      const result = await response.json();

      if (!cancelled) {
        setAlertsList(
          Array.isArray(result?.alerts) ? result.alerts : []
        );
      }
    } catch (err) {
      console.error('Failed to load personal alerts:', err);

      if (!cancelled) {
        setAlertsList([]);
        setError(
          'Alerts are unavailable right now. Please try again later.'
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  loadAlerts();

  return () => {
    cancelled = true;
  };
}, []);

  const getSeverity = (alert: any): 'critical' | 'warning' | 'info' => {
    const value = String(alert.severity || '').toLowerCase();
    if (['critical', 'high'].includes(value)) return 'critical';
    if (['warning', 'moderate', 'medium'].includes(value)) return 'warning';
    return 'info';
  };

  const getCategory = (alert: any) => {
    const title = String(alert.title || '').toLowerCase();
    if (title.includes('rain') || title.includes('precipitation')) return 'Rainfall';
    if (title.includes('water') || title.includes('moisture') || title.includes('drought')) return 'Water';
    if (title.includes('temp') || title.includes('heat')) return 'Temperature';
    if (title.includes('vegetation') || title.includes('ndvi')) return 'Vegetation';
    return 'Other';
  };

  const getFieldName = (alert: any) => {
    const id = String(alert.field_id ?? '');
    const saved = farm.fields.find(f => String(f.id) === id);
    return saved?.name || alert.field || alert.field_name || '';
  };

  const filteredByField = alertsList.filter(alert => {
    if (fieldFilter === 'All') return true;
    return String(alert.field_id ?? '') === fieldFilter ||
      getFieldName(alert) === farm.fields.find(f => String(f.id) === fieldFilter)?.name;
  });
  const filteredAlerts = filteredByField.filter(alert =>
    category === 'All' || getCategory(alert) === category
  );
  const counts = {
    critical: filteredByField.filter(a => getSeverity(a) === 'critical').length,
    warning: filteredByField.filter(a => getSeverity(a) === 'warning').length,
    info: filteredByField.filter(a => getSeverity(a) === 'info').length,
  };

  const severityStyle = {
    critical: { label: 'Critical', badge: 'bg-red-100 text-red-700', icon: 'bg-red-50 text-red-700' },
    warning: { label: 'Warning', badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-50 text-amber-700' },
    info: { label: 'Info', badge: 'bg-sky-100 text-sky-700', icon: 'bg-emerald-50 text-emerald-700' },
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <header>
        <h2 className="font-display text-3xl font-semibold text-[#172820]">Field Alerts</h2>
        <p className="text-muted-foreground mt-1">Important changes to monitor across your fields.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {([
          { key: 'critical', label: 'Critical', bg: 'bg-red-50/80', border: 'border-red-100', text: 'text-red-700' },
          { key: 'warning', label: 'Warnings', bg: 'bg-amber-50/80', border: 'border-amber-100', text: 'text-amber-700' },
          { key: 'info', label: 'Information', bg: 'bg-sky-50/80', border: 'border-sky-100', text: 'text-sky-700' },
        ] as const).map(item => (
          <div key={item.key} className={`flex items-center gap-4 rounded-xl border p-5 ${item.bg} ${item.border}`}>
            <div className={`rounded-xl bg-white/70 p-3 ${item.text}`}>
              {item.key === 'info' ? <Info className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#172820]">{loading ? '—' : counts[item.key]}</div>
              <div className="text-sm text-[#34413b]">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <select
          aria-label="Filter by field"
          value={fieldFilter}
          onChange={e => setFieldFilter(e.target.value)}
          className="w-full md:w-48 bg-white border border-[#e3e0d9] rounded-xl px-4 py-2.5 text-sm text-[#172820] outline-none focus:border-[#174D3B]"
        >
          <option value="All">All Fields</option>
          {farm.fields.map(field => <option key={field.id} value={String(field.id)}>{field.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {['All', 'Water', 'Rainfall', 'Temperature', 'Vegetation'].map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${category === item ? 'bg-[#172820] border-[#172820] text-white' : 'bg-white border-[#e3e0d9] text-[#34413b] hover:bg-[#f1f5f1]'}`}
            >{item}</button>
          ))}
        </div>
      </div>

      {loading ? <PageLoader /> : error ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{error}</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-xl border border-[#e3e0d9] bg-white p-10 text-center text-sm text-muted-foreground">
          No alerts found for this selection.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => {
            const severity = getSeverity(alert);
            const style = severityStyle[severity];
            const type = getCategory(alert);
            const Icon = type === 'Rainfall' ? CloudRain : type === 'Water' ? Droplets : type === 'Temperature' ? ThermometerSun : type === 'Vegetation' ? Leaf : AlertTriangle;
            const fieldName = getFieldName(alert);
            return (
              <article key={`${alert.id ?? index}-${alert.field_id ?? fieldName}`} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-[#e3e0d9] bg-white px-5 py-5 shadow-sm">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.icon}`}><Icon className="w-6 h-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-semibold text-base text-[#172820]">{alert.title || 'Field Alert'}{fieldName ? ` — ${fieldName}` : ''}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#59645e]">{alert.desc || alert.description || 'Environmental change detected.'}</p>
                </div>
                <time className="shrink-0 text-sm text-[#59645e] sm:self-start sm:pt-1">{alert.date || 'Date unavailable'}</time>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page 10: Data Explorer ───────────────────────────────────────────────────
function DataExplorer({ isDemo }: { isDemo: boolean }) {
  const farm = useFarm();
  const demo = useApiFetch<any>(isDemo ? '/api/data-explorer' : '');
  const personal = usePersonalNASA(!isDemo);
  const [variable, setVariable] = useState('soil_moisture');
  const mapCenter: [number, number] = farm.selectedField ? fieldCenter(farm.selectedField) : [23.685, 90.3563];
  const verts = geoJSONToVertices(farm.selectedField?.boundary);
  const data = isDemo ? demo.data : null;
  const seriesData = isDemo ? (data?.time_series || []) : (personal.data?.daily?.dates || []).map((day: string, i: number) => {
    const raw = personal.data?.daily?.[variable]?.[i];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return { month: day, val: value === null ? null : variable === 'soil_moisture' ? value * 100 : value };
  });
  const meta = isDemo ? (data?.metadata || {}) : {
    acquisition_date: personal.data?.end || '—',
    spatial_resolution: 'Dataset-dependent; point observations',
    temporal_resolution: 'Daily (NDVI may be interpolated)',
    processing_status: personal.data?.source || 'Pending',
    data_availability: typeof personal.data?.quality_score === 'number' ? `${(personal.data.quality_score * 100).toFixed(1)}% quality score` : '—',
  };
  const label = ({ soil_moisture: 'Root wetness (%)', rain: 'Rainfall (mm)', ndvi: 'NDVI', tmax: 'Max temperature (°C)', tmin: 'Min temperature (°C)' } as Record<string, string>)[variable];
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <header><h2 className="font-display text-3xl font-semibold mb-1">Data Explorer</h2><p className="text-muted-foreground text-lg">Environmental observations for the selected field.</p></header>
      <div className="flex flex-wrap gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <select value={variable} onChange={e => setVariable(e.target.value)} className="bg-muted border border-border text-sm font-medium rounded-md px-3 py-2">
          <option value="soil_moisture">Root wetness</option><option value="rain">Rainfall</option><option value="ndvi">NDVI</option><option value="tmax">Maximum temperature</option><option value="tmin">Minimum temperature</option>
        </select>
        <div className="bg-background border border-border text-sm rounded-md px-3 py-2">{farm.selectedField?.name || 'Select a field'}</div>
        <div className="bg-background border border-border text-sm rounded-md px-3 py-2">{isDemo ? 'Demo dataset' : `${personal.data?.start || '—'} → ${personal.data?.end || '—'}`}</div>
      </div>
      {!isDemo && personal.error && <p role="alert" className="text-sm text-red-700">NASA request failed: {personal.error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-card border border-border rounded-xl shadow-sm overflow-hidden h-[420px] relative">
          <MapContainer center={mapCenter} zoom={farm.selectedField ? 14 : 9} zoomControl={false} className="h-full w-full" key={farm.selectedFieldId || 'default'}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
            {verts.length >= 3 && <Polygon positions={verts} pathOptions={{ color: '#4682b4', weight: 3, fillOpacity: 0.3 }} />}
          </MapContainer>
          <div className="absolute bottom-4 left-4 z-[400] bg-card/95 px-3 py-2 rounded shadow border border-border text-sm">Saved field boundary · satellite basemap (not a NASA data raster)</div>
        </div>
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 min-h-[350px]">
            <h3 className="font-semibold text-lg mb-2">{isDemo ? 'Demo Time Series' : `NASA Time Series · ${label}`}</h3>
            <p className="text-xs text-muted-foreground mb-4">{personal.loading && !isDemo ? 'Loading observations…' : `${seriesData.length} dates · Missing values are not shown as zero`}</p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={35} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v) => [v == null ? 'Missing' : Number(v).toFixed(2), label]} />
                  <Area type="monotone" dataKey="val" connectNulls={false} stroke="#4682b4" fill="#4682b4" fillOpacity={0.15} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-4 pb-3 border-b border-border">Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs uppercase text-muted-foreground">Source classification</div><div className="font-medium">{meta.processing_status}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Last date</div><div className="font-medium">{meta.acquisition_date}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Spatial resolution</div><div className="font-medium">{meta.spatial_resolution}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Temporal resolution</div><div className="font-medium">{meta.temporal_resolution}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Quality</div><div className="font-medium">{meta.data_availability}</div></div>
              <div className="col-span-2 md:col-span-3"><div className="text-xs uppercase text-muted-foreground">Contributing sources</div><div className="font-medium">{isDemo ? 'Demo' : (personal.data?.sources || []).join(' · ') || '—'}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page 11: Reports ─────────────────────────────────────────────────────────
function Reports({ isDemo, onNavigate }: { isDemo: boolean; onNavigate: (tab: string) => void }) {
  const farm = useFarm();
  const { selectedFieldId } = farm;
  const demo = useApiFetch<any>(isDemo ? '/api/report' : '');
  const [personalReport, setPersonalReport] = useState<any>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (isDemo || !selectedFieldId) {
      setPersonalReport(null);
      setPersonalLoading(false);
      setPersonalError('');
      return;
    }
    let cancelled = false;
    setPersonalLoading(true);
    setPersonalError('');
    setPersonalReport(null);
    api.getPersonalReport(selectedFieldId, refreshKey > 0)
      .then(result => { if (!cancelled) setPersonalReport(result); })
      .catch(error => {
        if (!cancelled) setPersonalError(error instanceof Error ? error.message : 'Could not load the personal report.');
      })
      .finally(() => { if (!cancelled) setPersonalLoading(false); });
    return () => { cancelled = true; };
  }, [isDemo, selectedFieldId, refreshKey]);

  const loading = isDemo ? demo.loading : personalLoading;
  const d: any = isDemo ? (demo.data || {}) : (personalReport || {});
  const conditions: any = d.conditions || {};
  const rotations: any[] = Array.isArray(d.rotation_scenarios) ? d.rotation_scenarios : [];
  const uncertainties: any[] = Array.isArray(d.uncertainties) ? d.uncertainties : [];
  const sources: string[] = Array.isArray(d.data_sources) ? d.data_sources : [];
  const hasReport = isDemo ? !!demo.data : !!personalReport;
  const text = (value: unknown): string =>
    value === null || value === undefined || value === '' ? '—' : String(value);
  const numeric = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const metric = (formatted: unknown, value: unknown, unit: string, digits = 1) => {
    if (formatted !== null && formatted !== undefined && formatted !== '') return String(formatted);
    const number = numeric(value);
    return number === null ? '—' : `${number.toFixed(digits)}${unit}`;
  };
  // Reports and My Fields use the same backend shared NASA metrics.
  const waterStressDisplay = conditions.water_stress || 'Not assessed';
  const waterStressOrigin = 'Shared NASA POWER root-zone wetness screening (indicative, not crop-validated)';
  const conditionCards = [
    { label: 'Root-zone Wetness', value: metric(conditions.soil_moisture, conditions.soil_moisture_value, '%') },
    { label: 'Rainfall', value: metric(conditions.rainfall, conditions.rainfall_mm, ' mm') },
    { label: 'Temperature', value: metric(conditions.temperature, conditions.temperature_c, '°C') },
    { label: 'NDVI', value: metric(conditions.ndvi, conditions.ndvi_value, '', 3) },
    { label: 'Water Stress', value: waterStressDisplay },
  ];

  const exportReport = () => {
    if (!hasReport) return;
    window.print();
  };

  const shareReport = async () => {
    if (!hasReport || sharing) return;
    setSharing(true);
    const title = `${text(d.field_name)} — Seasonal Decision Report`;
    const summary = [
      title,
      `Farm: ${text(d.farm_name)}`,
      `Observation period: ${text(d.observation_period?.start)} to ${text(d.observation_period?.end)}`,
      `Rainfall: ${conditionCards[1].value}`,
      `Temperature: ${conditionCards[2].value}`,
      `NDVI: ${conditionCards[3].value}`,
      `Data sources: ${sources.length ? sources.join(', ') : 'Not provided'}`,
      'Missing measurements and unverified scores are not estimated.',
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ title, text: summary });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        window.alert('Report summary copied. You can share it with an agronomist.');
      } else window.alert('Sharing is unavailable in this browser.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        window.alert('Could not share the report.');
      }
    } finally { setSharing(false); }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1000px] mx-auto space-y-6 pb-24 print:p-0 print:max-w-none">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-1">
            {text(d.field_name || farm.selectedField?.name || (isDemo ? 'Demo Field' : 'Selected Field'))} — Seasonal Decision Report
          </h2>
          <p className="text-muted-foreground text-lg">A summary of field observations, crop conditions, and available rotation recommendations.</p>
          <p className="text-xs text-muted-foreground mt-2">
            {isDemo ? 'Demo data · Illustrative only' : 'Personal field · Authenticated report'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto print:hidden">
          {!isDemo && <button onClick={() => setRefreshKey(n => n + 1)} disabled={!selectedFieldId || loading} className="bg-card text-foreground font-semibold px-4 py-2.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 text-sm">Refresh NASA</button>}
          <button onClick={() => void shareReport()} disabled={!hasReport || sharing} className="flex-1 md:flex-none bg-card text-foreground font-semibold px-4 py-2.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors shadow-sm text-sm">Share with Agronomist</button>
          <button onClick={exportReport} disabled={!hasReport} className="flex-1 md:flex-none bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm text-sm">Export Report</button>
        </div>
      </header>

      {!isDemo && !selectedFieldId && <div className="bg-card border border-border rounded-xl p-8 text-muted-foreground">Select a saved field from the top menu to generate its report.</div>}
      {!isDemo && personalError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load the authenticated field report: {personalError}</div>}
      {loading && <PageLoader />}
      {!loading && selectedFieldId && !hasReport && !personalError && !isDemo && <div className="bg-card border border-border rounded-xl p-8 text-muted-foreground">No personal report returned for this field.</div>}
      {!loading && isDemo && !hasReport && <div className="bg-card border border-border rounded-xl p-8 text-muted-foreground">Demo report unavailable.</div>}

      {!loading && hasReport && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-10 space-y-10 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 font-semibold">{isDemo ? 'DEMO' : text(d.report_status || 'Personal report')}</span>
            {!isDemo && <span className="text-muted-foreground">Source classification: {text(d.observation_source)}</span>}
          </div>

          {/* Field Overview — full width; Field Resilience removed from Reports UI */}
          <section>
            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-4 border-b border-border pb-2">Field Overview</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Farm', d.farm_name || farm.farmName],
                ['Field', d.field_name || farm.selectedField?.name],
                ['Area', numeric(d.area_ha) !== null ? `${d.area_ha} ha` : null],
                ['Current Crop', d.current_crop],
                ['Location', d.location],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4"><span className="text-muted-foreground">{label}:</span><span className="font-semibold text-foreground text-right">{text(value)}</span></div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-4 border-b border-border pb-2">Current Conditions</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              {conditionCards.map((card, index) => (
                <div key={card.label} className={`p-3 rounded border ${index === 4 ? 'bg-accent/10 border-accent/20' : 'bg-muted/30 border-border'}`}>
                  <div className="text-muted-foreground text-xs mb-1">{card.label}</div>
                  <div className="font-bold text-lg break-words">{card.value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Root-zone wetness is a NASA POWER model-derived indicator, not an in-field measurement. Water stress: {waterStressOrigin}. Missing data is displayed as —.</p>
            <div className="mt-3 text-xs text-muted-foreground">
              Observation period: {text(d.observation_period?.start)} → {text(d.observation_period?.end)}
              {numeric(d.data_quality) !== null && ` · Data quality: ${d.data_quality}`}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-4 border-b border-border pb-2">Rotation Scenarios</h3>
            {rotations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground space-y-3">
                <button type="button" onClick={() => onNavigate('Rotation Planner')} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 print:hidden">
                  Open Rotation Planner <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rotations.map((r: any, index: number) => {
                  const score = r?.score || {};
                  const name = r.title || r.name || r.strategy_type || `Scenario ${index + 1}`;
                  const description = typeof r.desc === 'string' ? r.desc : typeof r.explanation === 'string' ? r.explanation : Array.isArray(r.crop_names) ? r.crop_names.join(' → ') : 'Scenario details provided by the rotation service.';
                  const water = numeric(r.water) ?? numeric(score.water_impact);
                  const soil = numeric(r.soil) ?? numeric(score.soil_impact);
                  const climate = numeric(r.climate) ?? numeric(score.resilience);
                  return (
                    <div key={`${name}-${index}`} className="border border-border rounded-lg p-4">
                      <div className="font-bold text-foreground mb-1">{name}</div>
                      <div className="text-xs text-muted-foreground mb-3">{description}</div>
                      <div className="space-y-2">
                        {water !== null && <ScoreBar label="Water" val={water} color="bg-water" />}
                        {soil !== null && <ScoreBar label="Soil" val={soil} color="bg-[#8a6c52]" />}
                        {climate !== null && <ScoreBar label="Climate" val={climate} color="bg-primary" />}
                        {water === null && soil === null && climate === null && <p className="text-xs text-muted-foreground">Comparable scores not available.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {rotations.length > 0 && <button type="button" onClick={() => onNavigate('Rotation Planner')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline print:hidden">View in Rotation Planner <ArrowRight className="h-4 w-4" /></button>}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <section className="bg-muted/30 border border-border rounded-lg p-5 text-sm">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-accent" /> Key Uncertainties</h3>
              {uncertainties.length === 0 ? <p className="text-muted-foreground">No uncertainty details were supplied.</p> : (
                <ul className="space-y-3 text-muted-foreground">
                  {uncertainties.map((u: any, index: number) => <li key={index} className="flex justify-between gap-3"><span>{text(u.key)}</span><span className="font-medium text-foreground text-right text-xs">{text(u.value)}</span></li>)}
                </ul>
              )}
            </section>
            <section className="bg-muted/30 border border-border rounded-lg p-5 text-sm">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Data Sources</h3>
              {sources.length === 0 ? <p className="text-muted-foreground">No source metadata supplied.</p> : (
                <div className="flex flex-wrap gap-2">{sources.map((source, index) => <span key={`${source}-${index}`} className="bg-background border border-border text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 rounded">{source}</span>)}</div>
              )}
            </section>
          </div>
          {Array.isArray(d.notes) && d.notes.length > 0 && (
            <section className="border-t border-border pt-5"><h3 className="font-semibold text-sm mb-2">Report Notes</h3><ul className="space-y-2 text-sm text-muted-foreground">{d.notes.map((note: unknown, index: number) => <li key={index}>• {text(note)}</li>)}</ul></section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page 12: Season Outcomes ─────────────────────────────────────────────────
function SeasonOutcomes() {
  const farm = useFarm();
  const [submitted, setSubmitted] = useState(false);
  const [actualYield, setActualYield] = useState<string>('');
  const [matchExperience, setMatchExperience] = useState<string>('');
  const [cropPlanted, setCropPlanted] = useState('Rice');
  const [waterUsed, setWaterUsed] = useState('As expected');
  const [weatherEvent, setWeatherEvent] = useState('None');
  const [farmerNote, setFarmerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);

  const expectedYield = responseData?.expected_yield_t_ha || 4.2;
  const parsedYield = parseFloat(actualYield);
  const diff = !isNaN(parsedYield) ? (parsedYield - expectedYield).toFixed(1) : null;
  const isDiffPositive = !isNaN(parsedYield) && parsedYield >= expectedYield;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await apiPost<any>('/api/season-outcomes', {
        field_id: farm.selectedFieldId || 'demo-1', season: String(new Date().getFullYear()), crop_planted: cropPlanted,
        actual_yield_t_ha: parsedYield || undefined,
        water_used: waterUsed, weather_event: weatherEvent,
        match_experience: matchExperience, farmer_note: farmerNote,
      });
      setResponseData(result);
    } catch {}
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[800px] mx-auto space-y-6 pb-24">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-semibold mb-1">Tell FutureField what happened</h2>
        <p className="text-muted-foreground text-lg">Report your post-season outcomes to help improve future recommendations.</p>
      </header>

      {!submitted ? (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 p-6 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">FutureField Prediction Context</div>
              <h3 className="font-semibold text-lg">{new Date().getFullYear()} Season • {farm.selectedField?.name || 'Selected Field'}</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-background border border-border px-4 py-2 rounded-lg text-center shadow-sm">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Expected Yield</div>
                <div className="font-display font-bold text-xl text-primary">{expectedYield} t/ha</div>
              </div>
              {diff !== null && (
                <div className={`px-4 py-2 rounded-lg text-center shadow-sm border ${isDiffPositive?'bg-green-500/10 border-green-500/20 text-green-700':'bg-amber-500/10 border-amber-500/20 text-amber-700'}`}>
                  <div className="text-[10px] uppercase font-bold mb-1 opacity-80">Difference</div>
                  <div className="font-display font-bold text-xl">{isDiffPositive?'+':''}{diff} t/ha</div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div>
              <h4 className="text-sm font-semibold mb-4 border-b border-border pb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">1</span> Your reported result
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Crop planted</label>
                  <select value={cropPlanted} onChange={e=>setCropPlanted(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    {(farm.lookups?.crops?.filter((c: any) => c.id !== 'fallow' && c.id !== 'cover').map((c: any) => c.name) || ['Rice','Wheat','Lentil','Maize','Mustard','Sorghum','Soybean','Potato','Mungbean']).map((name: string) => <option key={name}>{name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex justify-between">
                    Actual yield (t/ha)
                    {diff !== null && <span className={`text-xs ${isDiffPositive?'text-green-600':'text-amber-600'}`}>{isDiffPositive?'↑ Exceeded target':'↓ Below target'}</span>}
                  </label>
                  <input type="number" step="0.1" value={actualYield} onChange={(e)=>setActualYield(e.target.value)} placeholder="e.g. 3.8" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
                  {actualYield && !isNaN(parsedYield) && (
                    <div className="mt-3 relative h-2 bg-muted rounded-full overflow-hidden">
                      <div className="absolute top-0 left-0 h-full bg-primary opacity-30 rounded-full" style={{width:`${Math.min(100,(expectedYield/6)*100)}%`}} />
                      <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${isDiffPositive?'bg-green-500':'bg-amber-500'}`} style={{width:`${Math.min(100,(parsedYield/6)*100)}%`}} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Water used</label>
                  <select value={waterUsed} onChange={e=>setWaterUsed(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    <option>As expected</option><option>More than expected</option><option>Less than expected</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Major weather event</label>
                  <select value={weatherEvent} onChange={e=>setWeatherEvent(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors">
                    <option>None</option><option>Drought</option><option>Heavy rain / Flood</option><option>Heatwave</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 border-b border-border pb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">2</span> Did the recommendation match your experience?
              </h4>
              <div className="flex flex-wrap gap-3">
                {['Very close','Somewhat close','Different','Not sure'].map(opt=>(
                  <button key={opt} onClick={()=>setMatchExperience(opt)} className={`border px-4 py-2 rounded-lg text-sm font-medium transition-all ${matchExperience===opt?'bg-primary border-primary text-primary-foreground shadow-md scale-105':'bg-background border-border hover:border-primary/50 text-foreground'}`}>{opt}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Farmer note (Optional)</label>
              <textarea value={farmerNote} onChange={e=>setFarmerNote(e.target.value)} placeholder="e.g., Unexpected rainfall affected the field during early growth..." className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-primary transition-colors min-h-[100px]"></textarea>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <button onClick={handleSubmit} disabled={submitting} type="button" className="w-full md:w-auto bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Season Outcome'}
              </button>
              {(!actualYield || !matchExperience) && <span className="text-sm text-muted-foreground hidden md:inline-block">Fill out the fields to see dynamic charts!</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-8 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
            <CheckCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="font-display font-semibold text-2xl text-primary mb-2">Outcome Successfully Logged</h3>
          <p className="text-muted-foreground text-lg mb-8">Your feedback has been securely recorded. This real-world outcome data helps FutureField improve the accuracy of future recommendations for similar field conditions.</p>
          <button onClick={()=>{setSubmitted(false);setActualYield('');setMatchExperience('');setFarmerNote('');setResponseData(null);}} className="bg-background border border-border text-foreground font-semibold px-6 py-2.5 rounded-lg hover:bg-muted transition-colors">Log Another Field</button>
        </div>
      )}
    </div>
  );
}
  