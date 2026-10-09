import { Mascot, MASCOT_STATES } from "../../components/Mascot.jsx";

export const metadata = {
  title: "frfro mascot contact sheet",
  robots: { index: false, follow: false }
};

const SIZES = [24, 48, 96];

function StateGrid({ className = "" }) {
  return (
    <div className={`brandGrid ${className}`.trim()}>
      <span />
      {SIZES.map((size) => (
        <span key={size} className="brandGrid__colhead">{size}px</span>
      ))}
      {MASCOT_STATES.map((state) => (
        <Row key={state} state={state} />
      ))}
    </div>
  );
}

function Row({ state }) {
  return (
    <>
      <span className="brandGrid__label">{state}</span>
      {SIZES.map((size) => (
        <span key={size}><Mascot state={state} size={size} title /></span>
      ))}
    </>
  );
}

function BigRow({ className = "" }) {
  return (
    <div className={`brandBig ${className}`.trim()}>
      {MASCOT_STATES.map((state) => (
        <figure key={state}>
          <Mascot state={state} size={512} title />
          <figcaption>{state} · 512px</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Panel({ theme, title }) {
  return (
    <section className={`brandPanel is-${theme}`}>
      <h2>{title}</h2>
      <StateGrid />
      {theme === "dark" ? (
        <>
          <h3>Tinted (light body, dark eyes) for surfaces where black would vanish</h3>
          <StateGrid className="brandTint" />
        </>
      ) : null}
      <h3>512px</h3>
      <BigRow className={theme === "dark" ? "brandTint" : ""} />
    </section>
  );
}

export default function MascotContactSheet() {
  return (
    <main className="brandSheet">
      <header className="brandSheet__head">
        <h1>frfro mascot</h1>
        <p>All six states at 24, 48, 96 and 512px on light and dark surfaces. Every state shares one body and one pair of eye anchors.</p>
      </header>
      <div className="brandSheet__panels">
        <Panel theme="light" title="Light surface" />
        <Panel theme="dark" title="Dark surface" />
      </div>
    </main>
  );
}
