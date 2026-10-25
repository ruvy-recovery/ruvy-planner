export default function Landing({ onStart }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Ruvy Planner</h1>
      <p>Page d'accueil en construction.</p>
      {onStart && <button onClick={onStart}>Commencer</button>}
    </div>
  );
}