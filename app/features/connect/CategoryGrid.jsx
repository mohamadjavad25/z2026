"use client";

import { ServiceIcon } from "../../components/ServiceIcon";
import { CLIENT_CATEGORIES } from "../../shared/constants/clientCategories";

/** «چه کاری می‌خواهی؟»: what a client usually comes for, one tap each. */
export function CategoryGrid({ busyId = "", onPick }) {
  return (
    <div className="cnCats" role="group" aria-label="چه کاری می‌خواهی؟">
      {CLIENT_CATEGORIES.map((category) => (
        <button
          type="button"
          key={category.id}
          className={`cnCat${busyId === category.id ? " is-busy" : ""}`}
          disabled={Boolean(busyId)}
          onClick={() => onPick?.(category)}
        >
          <ServiceIcon emoji={category.icon} name={category.label} size="md" />
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
