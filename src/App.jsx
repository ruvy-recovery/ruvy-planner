import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [taches, setTaches] = useState(() => {
    const sauvegarde = localStorage.getItem('taches')
    return sauvegarde ? JSON.parse(sauvegarde) : []
  })
  const [nouvelleTache, setNouvelleTache] = useState('')

  useEffect(() => {
    localStorage.setItem('taches', JSON.stringify(taches))
  }, [taches])

  function ajouterTache() {
    if (nouvelleTache.trim() === '') return
    setTaches([...taches, { id: Date.now(), texte: nouvelleTache, fait: false }])
    setNouvelleTache('')
  }

  function toggleTache(id) {
    setTaches(taches.map(t => t.id === id ? { ...t, fait: !t.fait } : t))
  }

  function supprimerTache(id) {
    setTaches(taches.filter(t => t.id !== id))
  }

  return (
    <div className="App">
      <header>
        <h1>Planificateur Ruvy</h1>
        <p>Organisez ta vie, un jour à la fois</p>
      </header>

      <main id="accueil">
        <section>
          <h2>Ajouter une tâche</h2>
          <input
            type="text"
            value={nouvelleTache}
            onChange={(e) => setNouvelleTache(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ajouterTache()}
            placeholder="Écris une tâche..."
          />
          <button onClick={ajouterTache}>Ajouter</button>
        </section>

        <section>
          <h2>Mes tâches</h2>
          {taches.length === 0 && <p>Aucune tâche pour le moment.</p>}
          <ul>
            {taches.map(t => (
              <li key={t.id} style={{ textDecoration: t.fait ? 'line-through' : 'none' }}>
                <input
                  type="checkbox"
                  checked={t.fait}
                  onChange={() => toggleTache(t.id)}
                />
                {t.texte}
                <button onClick={() => supprimerTache(t.id)}>❌</button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer>
        <p>© 2026 Ruvy Planner</p>
      </footer>
    </div>
  )
}

export default App