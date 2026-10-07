import { ChevronLeft } from "lucide-react";
import { RoleGlyph } from "../../components/RoleGlyphs";

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
              <RoleGlyph id={role.id} size={36} />
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
