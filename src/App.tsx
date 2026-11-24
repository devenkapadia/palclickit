import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicSite from './public/PublicSite';
import { Spinner } from './components/ui';

// The admin bundle is only downloaded when someone visits /admin.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Suspense fallback={<Spinner />}><AdminApp /></Suspense>} />
      <Route path="*" element={<PublicSite />} />
    </Routes>
  );
}
