import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import VirusBrowser from './pages/VirusBrowser';
import VirusDetail from './pages/VirusDetail';
import ProteinDetail from './pages/ProteinDetail';
import OrganismDetail from './pages/OrganismDetail';
import Statistics from './pages/Statistics';
import ViralTree from './pages/ViralTree';
import Methods from './pages/Methods';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<VirusBrowser />} />
          <Route path="virus/:virusId" element={<VirusDetail />} />
          <Route path="protein/:proteinId" element={<ProteinDetail />} />
          <Route path="organism/:organism" element={<OrganismDetail />} />
          <Route path="stats" element={<Statistics />} />
          <Route path="taxonomy" element={<ViralTree />} />
          <Route path="methods" element={<Methods />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
