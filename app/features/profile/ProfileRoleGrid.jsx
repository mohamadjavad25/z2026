import { ChevronLeft } from "lucide-react";
import { PageIcon } from "../../components/PageIcon";
import { ServiceEmoji } from "../../components/ServiceEmoji";

// One concept icon per role: person (client), storefront (salon), brush (artist).
function RoleGlyph({ id }) {
  if (id === "salon") return <PageIcon name="salon" size={32} />;
  if (id === "artist") return <ServiceEmoji id="makeup_brush" size={32} />;
  return <PageIcon name="me" size={32} />;
}

export function ProfileRoleGrid({ roles, onSelectRole }) {
  return (
    <div className="profileRoleGrid" role="group" aria-label="انتخاب نوع پروفایل">
      {roles.map((role, index) => {
        return (
          <button
            type="button"
            className={`profileRoleCard ${role.tone}`}
            key={role.id}
            style={{ "--role-delay": `${index * 60}ms` }}
            onClick={() => onSelectRole(role.id)}
          >
            <span className="profileRoleIcon" aria-hidden="true">
              <RoleGlyph id={role.id} />
            </span>
            <span className="profileRoleCopy">
              <strong>{role.label}</strong>
              <small>{role.hint}</small>
            </span>
            <span className="profileRoleGo" aria-hidden="true">
              <ChevronLeft size={18} strokeWidth={2.2} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
