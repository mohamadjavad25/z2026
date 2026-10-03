import { ServiceIcon } from "./ServiceIcon";

const DEFAULT_IDS = ["haircut", "lipstick", "manicure", "facial", "massage"];

/** A lively row of floating service icons for empty states and headers. */
export function ServiceIconStrip({ ids = DEFAULT_IDS, size = "md" }) {
  return (
    <span className="svcIconStrip" aria-hidden="true">
      {ids.map((id, index) => (
        <ServiceIcon key={id} emoji={id} size={size} className="svcFloat" style={{ "--svc-float-delay": `${index * 0.35}s` }} />
      ))}
    </span>
  );
}
