import { Check, ChevronLeft, Clock, Plus, QrCode, Search, Settings, Share2, Bell, Users, CalendarPlus, ImagePlus } from "lucide-react";

/**
 * One mock app screen for a tutorial scene (scripts in tutorials.js). Pure: the player
 * (LearnSection.jsx) decides which scene shows and moves the finger to the element whose
 * `data-tap` matches the scene's `tap`. Sizes are in em, so the whole screen scales with the phone.
 *
 * Element types: title, bar, tabs, rail, search, field, check, roles, head, note, summary, chips,
 * place, service, btn, btns, empty, status, request, rows, qr, scan, grid, gallery, photo, hero, nav.
 */

const ACTION_ICONS = { "اشتراک‌گذاری": Share2, "کد QR و اسکن": QrCode, "اعلان‌ها": Bell };

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

/** Text that types itself in when `type` is set (CSS clip reveal, one step per letter). */
function Typed({ text, type, ltr }) {
  if (!text) return null;
  if (!type) return <span dir={ltr ? "ltr" : undefined}>{text}</span>;
  return (
    <span className={cx("lsType", ltr && "is-ltr")} dir={ltr ? "ltr" : undefined} style={{ "--n": Array.from(text).length }}>
      {text}
    </span>
  );
}

function Avatar({ letter, small }) {
  return <span className={cx("lsAvatar", small && "is-small")} aria-hidden="true">{letter}</span>;
}

function Element({ el, tap, icons }) {
  // data-tap marks what the finger can press; the scene's target also gets "is-target" (press animation).
  const at = (key) => ({ "data-tap": key, className: tap === key ? "is-target" : undefined });
  const icon = (id) => (icons[id] ? <img className="lsIcon" src={icons[id]} alt="" /> : <span className="lsIcon" />);

  switch (el.t) {
    case "title":
      return (
        <div className="lsTitle">
          <strong>{el.text}</strong>
          {el.sub ? <span>{el.sub}</span> : null}
        </div>
      );
    case "bar":
      return (
        <div className="lsBar">
          {el.back ? <ChevronLeft className="lsBarBack" aria-hidden="true" /> : null}
          <strong>{el.text}</strong>
        </div>
      );
    case "tabs":
      return (
        <div className="lsTabs">
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            return <span key={item} {...props} className={cx(props.className, index === el.on && "is-on")}>{item}</span>;
          })}
        </div>
      );
    case "rail":
      return (
        <div className="lsRail">
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            return <span key={item} {...props} className={cx(props.className, index === el.on && "is-on")}>{item}</span>;
          })}
        </div>
      );
    case "search": {
      const props = at(el.id);
      return (
        <div {...props} className={cx("lsSearch", props.className, el.text && "is-filled")}>
          <Search aria-hidden="true" />
          {el.text ? <Typed text={el.text} type={el.type} /> : <span className="lsPlaceholder">{el.placeholder}</span>}
        </div>
      );
    }
    case "field": {
      const props = at(el.id);
      return (
        <div className="lsFieldWrap">
          {el.label ? <span className="lsLabel">{el.label}</span> : null}
          <div {...props} className={cx("lsField", props.className, el.type && "is-focus")}>
            {el.text ? <Typed text={el.text} type={el.type} ltr={el.ltr} /> : <span className="lsPlaceholder">{el.placeholder}</span>}
          </div>
        </div>
      );
    }
    case "check": {
      const props = at(el.id);
      return (
        <div {...props} className={cx("lsCheck", props.className, el.on && "is-on")}>
          <span className="lsCheckBox">{el.on ? <Check aria-hidden="true" /> : null}</span>
          {el.text}
        </div>
      );
    }
    case "roles":
      return (
        <div className="lsRoles">
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            return (
              <div key={item.name} {...props} className={cx("lsRole", props.className, index === el.on && "is-on")}>
                <strong>{item.name}</strong>
                <span>{item.sub}</span>
              </div>
            );
          })}
        </div>
      );
    case "head":
      return (
        <div className="lsHead">
          <strong>{el.text}</strong>
          {el.sub ? <span>{el.sub}</span> : null}
        </div>
      );
    case "note":
      return <p className="lsNote">{el.text}</p>;
    case "summary":
      return <p className="lsSummary">{el.text}</p>;
    case "chips":
      return (
        <div className={cx("lsChips", el.grid && "is-grid")} style={el.grid ? { "--cols": el.grid } : undefined}>
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            const label = typeof item === "string" ? item : item.a;
            return (
              <span key={label} {...props} className={cx("lsChip", props.className, index === el.on && "is-on")}>
                {label}
                {typeof item === "string" ? null : <small>{item.b}</small>}
              </span>
            );
          })}
        </div>
      );
    case "place": {
      const props = at(el.id);
      return (
        <div className="lsCard lsPlace">
          <Avatar letter={el.letter} />
          <span className="lsPlaceText">
            <strong>{el.name}</strong>
            <span>{el.sub}</span>
          </span>
          {el.btn ? <span {...props} className={cx("lsMini", props.className)}>{el.btn}</span> : null}
          {el.badge ? <span className="lsBadge is-ok">{el.badge}</span> : null}
        </div>
      );
    }
    case "service": {
      const props = at(el.id);
      return (
        <div className="lsService">
          {icon(el.icon)}
          <span className="lsPlaceText">
            <strong>{el.name}</strong>
            <span>{el.meta}</span>
          </span>
          {el.btn ? <span {...props} className={cx("lsMini", props.className)}>{el.btn}</span> : null}
        </div>
      );
    }
    case "btn": {
      const props = at(el.id);
      return <div {...props} className={cx("lsBtn", props.className, el.ghost && "is-ghost")}>{el.text}</div>;
    }
    case "btns":
      return (
        <div className="lsBtns">
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            return <span key={item.text} {...props} className={cx("lsBtn", props.className, item.ghost && "is-ghost")}>{item.text}</span>;
          })}
        </div>
      );
    case "empty":
      return (
        <div className="lsEmpty">
          <img src={el.img} alt="" />
          <strong>{el.title}</strong>
          <span>{el.text}</span>
        </div>
      );
    case "status":
      return (
        <div className={cx("lsStatus", `is-${el.tone}`)}>
          <span className="lsStatusIcon">{el.tone === "ok" ? <Check aria-hidden="true" /> : <Clock aria-hidden="true" />}</span>
          <span className="lsPlaceText">
            <strong>{el.title}</strong>
            <span>{el.text}</span>
            {el.when ? <b>{el.when}</b> : null}
          </span>
        </div>
      );
    case "request": {
      const props = at(el.id);
      const card = el.btn ? {} : props;
      return (
        <div {...card} className={cx("lsCard lsRequest", card.className, `is-${el.tone}`)}>
          <Avatar letter={el.name.slice(0, 1)} small />
          <span className="lsPlaceText">
            <strong>{el.name}</strong>
            <span>{el.service} · {el.when}</span>
          </span>
          {el.btn ? <span {...props} className={cx("lsMini", props.className)}>{el.btn}</span> : <span className={cx("lsBadge", `is-${el.tone}`)}>{el.badge}</span>}
        </div>
      );
    }
    case "rows":
      return (
        <div className="lsRows">
          {el.items.map((item, index) => {
            const props = at(`${el.id}.${index}`);
            return (
              <div key={item.a} {...props} className={cx("lsRow", props.className)}>
                <span className="lsPlaceText">
                  <strong>{item.a}</strong>
                  {item.b ? <span>{item.b}</span> : null}
                </span>
                {item.badge ? <span className={cx("lsBadge", item.badge === "فعال" || item.badge === "تازه" ? "is-ok" : "is-new")}>{item.badge}</span> : null}
                {"toggle" in item ? <span className={cx("lsToggle", item.toggle && "is-on")} /> : null}
                {el.chevron ? <ChevronLeft className="lsChevron" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      );
    case "qr":
      return (
        <div className="lsQr">
          <div className="lsQrCode"><QrPattern /></div>
          <strong>{el.name}</strong>
          <span>{el.text}</span>
        </div>
      );
    case "scan":
      return (
        <div className="lsScan">
          <div className="lsScanView">
            <span className="lsScanFrame"><QrPattern /></span>
            <span className="lsScanLine" />
          </div>
          <p>{el.text}</p>
          {el.found ? (
            <div className="lsCard lsPlace lsFound">
              <Avatar letter={el.found.name.replace("سالن ", "").slice(0, 1)} />
              <span className="lsPlaceText">
                <strong>{el.found.name}</strong>
                <span>{el.found.sub}</span>
              </span>
              <span {...at("found")} className={cx("lsMini", tap === "found" && "is-target")}>{el.found.btn}</span>
            </div>
          ) : null}
        </div>
      );
    case "grid":
      return (
        <div className="lsGrid">
          {el.items.map((item, index) => (
            <span key={item.label} {...at(`${el.id}.${index}`)}>
              {icon(item.icon)}
              {item.label}
            </span>
          ))}
        </div>
      );
    case "gallery":
      return (
        <div className="lsGallery">
          {el.add ? <span {...at(`${el.id}.add`)} className={cx("lsTile is-add", tap === `${el.id}.add` && "is-target")}><Plus aria-hidden="true" /></span> : null}
          {el.items.map((id, index) => (
            <span key={id} className={cx("lsTile", el.fresh && index === 0 && "is-fresh")}>{icon(id)}</span>
          ))}
        </div>
      );
    case "photo": {
      const props = at(el.id);
      return (
        <div {...props} className={cx("lsPhoto", props.className, el.icon && "is-filled")}>
          {el.icon ? icon(el.icon) : (
            <>
              <ImagePlus aria-hidden="true" />
              <span>تصویر نمونه‌کار را آپلود کن</span>
            </>
          )}
        </div>
      );
    }
    case "hero":
      return (
        <div className="lsHero">
          <span className="lsHeroCover" />
          <Avatar letter={el.letter} />
          <strong>{el.name}</strong>
          <span>{el.sub}</span>
          {el.actions ? (
            <div className="lsHeroActions">
              {el.actions.items.map((label, index) => {
                const Icon = ACTION_ICONS[label] || Share2;
                const props = at(`${el.actions.id}.${index}`);
                return (
                  <span key={label} {...props} title={label}>
                    <Icon aria-hidden="true" />
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    case "nav":
      return (
        <div className="lsNav">
          <span {...at(`${el.id}.0`)} className={cx(tap === `${el.id}.0` && "is-target", el.on === 0 && "is-on")}>
            <Settings aria-hidden="true" />
            تنظیمات
          </span>
          <span {...at(`${el.id}.1`)} className={cx("lsNavMe", tap === `${el.id}.1` && "is-target", el.on === 1 && "is-on")} />
          <span {...at(`${el.id}.2`)} className={cx(tap === `${el.id}.2` && "is-target", el.on === 2 && "is-on")}>
            {el.biz ? <Users aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
            {el.biz ? "مشتریان" : "رزرو"}
          </span>
        </div>
      );
    default:
      return null;
  }
}

/** A fixed QR-looking pattern (decorative; not a real code). */
function QrPattern() {
  const cells = Array.from({ length: 144 }, (_, index) => {
    const x = index % 12;
    const y = Math.floor(index / 12);
    return (x * 7 + y * 13 + x * y) % 5 < 2;
  });
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
      {cells.map((on, index) => (on ? <rect key={index} x={index % 12} y={Math.floor(index / 12)} width="1" height="1" /> : null))}
      {[[0, 0], [8, 0], [0, 8]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="4" height="4" fill="#fff" />
          <rect x={x + 0.5} y={y + 0.5} width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect x={x + 1.5} y={y + 1.5} width="1" height="1" />
        </g>
      ))}
    </svg>
  );
}

export function TutorialScreen({ scene, icons }) {
  const tap = scene.tap || "";
  const bottom = scene.els.filter((el) => el.t === "nav");
  const body = scene.els.filter((el) => el.t !== "nav");
  return (
    <div className="lsScreenInner">
      <div className="lsBody">
        {body.map((el, index) => <Element key={`${el.t}-${el.id || index}`} el={el} tap={tap} icons={icons} />)}
      </div>
      {bottom.map((el) => <Element key="nav" el={el} tap={tap} icons={icons} />)}
    </div>
  );
}

export function TutorialSheet({ sheet, tap, icons }) {
  return (
    <div className="lsSheet">
      <span className="lsSheetGrip" />
      <strong className="lsSheetTitle">{sheet.title}</strong>
      {sheet.els.map((el, index) => <Element key={`${el.t}-${el.id || index}`} el={el} tap={tap || ""} icons={icons} />)}
    </div>
  );
}
