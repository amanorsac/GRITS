import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './styles.css';
import './site.css';
import { Crown, RequireRole } from './components/ui';
import { AuthProvider } from './lib/auth';
import { initSupabase, supabaseConfigError } from './lib/supabase';
import Home from './pages/site/Home';
import { About, Contact, Events, Journal as SiteJournal, Programs } from './pages/site/Pages';
import InnerCourtCourse from './pages/site/Course';
import { Join, Login, SetPassword, VerifyCertificate } from './pages/Auth';
import Enrol, { EnrolComplete } from './pages/Enrol';
import Legal from './pages/Legal';
import MemberLayout from './pages/member/Layout';
import MemberHome from './pages/member/Home';
import { Academy, Journal, LessonPage, ModulePage, TalkToSomeone } from './pages/member/Academy';
import Court from './pages/member/Court';
import { LiveList, LiveRoom } from './pages/member/Live';
// Parents and staff load their areas on demand, so girls on mobile data never download them.
const Gate = lazy(() => import('./pages/Gate'));
const palace = () => import('./pages/palace/Palace');
const PalaceLayout = lazy(() => palace().then((m) => ({ default: m.PalaceLayout })));
const PalaceOverview = lazy(() => palace().then((m) => ({ default: m.PalaceOverview })));
const Moderation = lazy(() => palace().then((m) => ({ default: m.Moderation })));
const Members = lazy(() => palace().then((m) => ({ default: m.Members })));
const Content = lazy(() => palace().then((m) => ({ default: m.Content })));
const LiveAdmin = lazy(() => palace().then((m) => ({ default: m.LiveAdmin })));
const Commerce = lazy(() => palace().then((m) => ({ default: m.Commerce })));
const HelpQueue = lazy(() => palace().then((m) => ({ default: m.HelpQueue })));
const People = lazy(() => palace().then((m) => ({ default: m.People })));

const Wait = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<div className="center-page"><Crown size={48} /></div>}>{children}</Suspense>
);

const MEMBER_AREA = ['member', 'mentor', 'moderator', 'admin', 'owner'] as const;
const STAFF = ['mentor', 'moderator', 'admin', 'owner'] as const;

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/programs', element: <Programs /> },
  { path: '/programs/inner-court', element: <InnerCourtCourse /> },
  { path: '/events', element: <Events /> },
  { path: '/journal', element: <SiteJournal /> },
  { path: '/contact', element: <Contact /> },
  { path: '/login', element: <Login /> },
  { path: '/join', element: <Join /> },
  { path: '/enrol', element: <Enrol /> },
  { path: '/enrol/complete', element: <EnrolComplete /> },
  { path: '/account/password', element: <SetPassword /> },
  { path: '/verify', element: <VerifyCertificate /> },
  { path: '/privacy', element: <Legal doc="privacy" /> },
  { path: '/terms', element: <Legal doc="terms" /> },
  { path: '/safeguarding', element: <Legal doc="safeguarding" /> },
  {
    path: '/gate',
    element: (
      <RequireRole roles={['parent']}>
        <Wait>
          <Gate />
        </Wait>
      </RequireRole>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireRole roles={[...MEMBER_AREA]}>
        <MemberLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <MemberHome /> },
      { path: 'academy', element: <Academy /> },
      { path: 'academy/:moduleId', element: <ModulePage /> },
      { path: 'lesson/:lessonId', element: <LessonPage /> },
      { path: 'court', element: <Court /> },
      { path: 'live', element: <LiveList /> },
      { path: 'live/:sessionId', element: <LiveRoom /> },
      { path: 'journal', element: <Journal /> },
      { path: 'help', element: <TalkToSomeone /> },
    ],
  },
  {
    path: '/palace',
    element: (
      <RequireRole roles={[...STAFF]}>
        <Wait>
          <PalaceLayout />
        </Wait>
      </RequireRole>
    ),
    children: [
      { index: true, element: <PalaceOverview /> },
      { path: 'moderation', element: <Moderation /> },
      { path: 'members', element: <Members /> },
      { path: 'content', element: <Content /> },
      { path: 'live', element: <LiveAdmin /> },
      { path: 'commerce', element: <Commerce /> },
      { path: 'help', element: <HelpQueue /> },
      { path: 'people', element: <People /> },
    ],
  },
  { path: '*', element: <Home /> },
]);

const root = createRoot(document.getElementById('root')!);

initSupabase().then((client) => {
  if (!client) {
    root.render(
      <div className="center-page">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <Crown size={48} />
          <h2>Almost ready</h2>
          <p className="muted">{supabaseConfigError()}</p>
          <p className="small muted">Set SUPABASE_ANON_KEY on the “grits” Worker (Cloudflare → Workers → grits → Settings → Variables).</p>
        </div>
      </div>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </StrictMode>,
  );
});
