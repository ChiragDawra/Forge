import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Project from './pages/Project'
import Settings from './pages/Settings'
import Models from './pages/Models'

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="project/:id" element={<Project />} />
          <Route path="settings" element={<Settings />} />
          <Route path="models" element={<Models />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
