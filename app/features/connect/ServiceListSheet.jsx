"use client";

import { ServiceIcon } from "../../components/ServiceIcon";
import { servicesOfCategory } from "../../shared/constants/clientServices";
import { ConnectSheet } from "./ConnectSheet";

/** A tile's services (clientServices.js), one tap each (owner, 2026-11-12: every service under its tile). */
export function ServiceListSheet({ category, busyId = "", onPick, onClose }) {
  const services = servicesOfCategory(category.id);
  return (
    <ConnectSheet
      label={category.label}
      icon={<ServiceIcon emoji={category.icon} name={category.label} size="sm" />}
      title={category.label}
      subtitle="کدوم؟"
      onClose={onClose}
    >
      <div className="crServices">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} busy={busyId === service.id} disabled={Boolean(busyId)} onPick={onPick} />
        ))}
      </div>
    </ConnectSheet>
  );
}

/** One service to pick: its icon and name; `near` adds «شبیهش» for a match by another word. */
export function ServiceRow({ service, near = false, busy = false, disabled = false, onPick }) {
  return (
    <button type="button" className={`crServiceRow${busy ? " is-busy" : ""}`} disabled={disabled} onClick={() => onPick?.(service)}>
      <ServiceIcon emoji={service.icon} name={service.name} size="sm" />
      <b>{service.name}</b>
      {near ? <em className="cnPickTag">شبیهش</em> : null}
    </button>
  );
}
