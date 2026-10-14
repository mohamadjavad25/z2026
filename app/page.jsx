import { AppLanding } from "./features/landing/AppLanding";
import { HomeGate } from "./features/landing/HomeGate";

// Phones get the app; tablets and desktops get the about/download page (landing.css).
export default function Home() {
  return (
    <>
      <div className="landingSlot">
        <AppLanding />
      </div>
      <HomeGate />
    </>
  );
}
