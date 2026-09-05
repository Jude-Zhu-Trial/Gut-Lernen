import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import StudyPage from './pages/study/StudyPage';
import StatsPage from './pages/stats/StatsPage';
import WordListsPage from './pages/wordlists/WordListsPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StudyPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="wordlists" element={<WordListsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
