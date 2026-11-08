"use client";

import { Fragment } from "react";
import { toPersianDigits } from "../shared/lib/digits";
import { groupServicesByCategory } from "../shared/lib/serviceGroups";

/**
 * A services list split by category, each with a small title (name, hairline, count). With only one
 * category there is nothing to tell apart, so the cards come out bare. `children(service, index)` renders a card.
 */
export function ServiceGroups({ services, children, action = null }) {
  const groups = groupServicesByCategory(services);
  let index = 0;
  // With an `action` (a button per group), even a single group gets its title so the button has a home.
  if (groups.length < 2 && !(action && groups.length)) return <>{(services || []).map((service) => <Fragment key={service.id}>{children(service, index++)}</Fragment>)}</>;
  return (
    <>
      {groups.map((group) => (
        <section className="svcGroup" key={group.id} aria-label={group.fa}>
          <h3 className="svcGroupHead"><span>{group.fa}</span><i aria-hidden="true" /><small>{toPersianDigits(group.items.length)}</small>{action ? action(group) : null}</h3>
          {group.items.map((service) => <Fragment key={service.id}>{children(service, index++)}</Fragment>)}
        </section>
      ))}
    </>
  );
}
