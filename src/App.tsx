import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import VirusBrowser from './pages/VirusBrowser';
import VirusDetail from './pages/VirusDetail';
import ProteinDetail from './pages/ProteinDetail';
import Statistics from './pages/Statistics';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<VirusBrowser />} />
          <Route path="virus/:virusId" element={<VirusDetail />} />
          <Route path="protein/:proteinId" element={<ProteinDetail />} />
          <Route path="stats" element={<Statistics />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
