import { appMeta } from "./app-meta";

export function App() {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="intro-panel">
        <p className="eyebrow">{appMeta.status}</p>
        <h1 id="app-title">{appMeta.name}</h1>
        <p className="tagline">{appMeta.tagline}</p>
        <p className="description">{appMeta.description}</p>
        <dl className="status-grid" aria-label="Application baseline">
          <div>
            <dt>Runtime</dt>
            <dd>PWA-ready shell</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>Not initialized yet</dd>
          </div>
          <div>
            <dt>Deployment</dt>
            <dd>Cloudflare Pages compatible</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
