import { appMeta } from "./app-meta";
import {
  getAppEnvironment,
  getAppEnvironmentLabel,
  shouldShowEnvironmentBadge
} from "./app-env";

export function App() {
  const appEnvironment = getAppEnvironment();

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="intro-panel">
        <div className="intro-header">
          <p className="eyebrow">{appMeta.status}</p>
          {shouldShowEnvironmentBadge(appEnvironment) ? (
            <span className="environment-badge">
              {getAppEnvironmentLabel(appEnvironment)}
            </span>
          ) : null}
        </div>
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
