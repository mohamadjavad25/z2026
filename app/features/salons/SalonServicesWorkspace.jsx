"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus, UserRound, Users } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { servicePriceText } from "../../shared/lib/money";
import { ServiceLead } from "../../components/ServicePhoto";
import { ServicePhotosEditor } from "../profile/ServicePhotosSheet";
import { ServiceGroups } from "../../components/ServiceGroups";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { Mascot } from "../../components/Mascot";
import { ProfileSheet } from "../profile/ProfileSheet";
import { DueRemindersButton, DueServiceChip } from "../dueReminders/DueReminders";

/**
 * Salon owner — services manager (workspace key "hours" / label خدمات).
 * Presentational: service rows + artist assign + create/edit callbacks.
 * Tapping a card opens its editor; delete lives inside that editor, so the card
 * itself stays clean (no edit / delete buttons on the row).
 */
export function SalonServicesWorkspace({
  services = [],
  staffList = [],
  serviceArtistMenuId = null,
  onMenuToggle,
  onCreate,
  onToggleArtist,
  onClearArtists,
  onEdit,
  onPhotosChanged
}) {
  // The service whose sample photos are being picked.
  const [photoService, setPhotoService] = useState(null);
  // Design sample: the order of a service's artists, per service, on this screen only.
  const [artistOrder, setArtistOrder] = useState({});
  const [groupSheet, setGroupSheet] = useState(null);
  const orderedPicked = (serviceId, ids) => {
    const saved = (artistOrder[serviceId] || []).filter((id) => ids.includes(id));
    return [...saved, ...ids.filter((id) => !saved.includes(id))];
  };
  const moveArtist = (serviceId, picked, index, step) => {
    const next = [...picked];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setArtistOrder((current) => ({ ...current, [serviceId]: next }));
  };
  const idsOf = (service) => (Array.isArray(service.staff_ids)
    ? service.staff_ids.map(String)
    : String(service.staff_ids || "").trim()
      ? String(service.staff_ids).split(",").map((id) => id.trim()).filter(Boolean)
      : service.staff_id ? [String(service.staff_id)] : []);
  // «آرتیست‌های ناخن»: one artist on or off for every service of a group at once.
  const group = groupSheet ? { ...groupSheet, items: services.filter((service) => groupSheet.ids.includes(service.id)) } : null;
  const toggleGroupArtist = (personId) => {
    const id = String(personId);
    const onAll = group.items.every((service) => idsOf(service).includes(id));
    group.items.forEach((service) => {
      if (idsOf(service).includes(id) === onAll) onToggleArtist?.(service, personId);
    });
  };
  return (
    <>
      <div className="svcToolbar">
        <DueRemindersButton />
        <button type="button" className="svcAddBtn" onClick={onCreate}>
          <Plus size={16} />
          خدمت تازه
        </button>
      </div>
      <div className="svcList salonServiceManagerList">
        {services.length === 0 ? (
          <ProfileEmptyState
            className="artistServiceEmpty"
            visual={<Mascot pose="no-services" size={140} />}
            title="منوت هنوز خالیه"
            description="خدمت‌هات رو بذار تا مشتری روز، ساعت و آرتیستش رو انتخاب کنه."
            actionLabel="اولین خدمت رو بذار"
            onAction={onCreate}
          />
        ) : (
          <ServiceGroups
            services={services}
            action={staffList.length ? (item) => (
              <button
                type="button"
                className="svcGroupArtists"
                onClick={() => setGroupSheet({ fa: item.fa, ids: item.items.map((service) => service.id) })}
              >
                <Users size={13} aria-hidden="true" />
                آرتیست‌ها
              </button>
            ) : null}
          >{(service) => {
            const selectedArtistIds = Array.isArray(service.staff_ids)
              ? service.staff_ids.map(String)
              : String(service.staff_ids || "").trim()
                ? String(service.staff_ids).split(",").map((id) => id.trim()).filter(Boolean)
              : service.staff_id
                ? [String(service.staff_id)]
                : [];
            const selectedArtists = staffList.filter((person) => selectedArtistIds.includes(String(person.id)));
            const fallbackAssignedStaff = staffList.find((person) => String(person.id) === String(service.staff_id));
            const visibleArtists = selectedArtists.length ? selectedArtists : fallbackAssignedStaff ? [fallbackAssignedStaff] : [];
            const artistLabel = visibleArtists.length
              ? visibleArtists.map((person) => person.name).join("، ")
              : "";
            const menuOpen = String(serviceArtistMenuId) === String(service.id);
            // Linked automatically from their field of work (see serviceSkills.js).
            const autoIds = (Array.isArray(service.staff_auto_ids) ? service.staff_auto_ids : []).map(String);
            return (
              <article
                className={`svcCard is-manager is-editable${menuOpen ? " is-pickingArtist" : ""}`}
                key={service.id}
              >
                {/* Covers the whole card: one tap opens the editor. The artist picker sits above it. */}
                <button
                  type="button"
                  className="svcCardOpen"
                  aria-label={`ویرایش ${service.name}`}
                  onClick={() => onEdit?.(service)}
                />
                <ServiceLead service={service} onPhotos={() => setPhotoService(service)} />
                <div className="svcCardBody">
                  <div className="svcCardTitle"><strong>{service.name}</strong></div>
                  {service.hint ? <p className="svcCardHint">{service.hint}</p> : null}
                  <div className="svcCardMeta">
                    <span className="svcChip is-price">{servicePriceText(service.price) || "قیمت بذار"}</span>
                    <span className="svcChip">{service.duration || "مدت بذار"}</span>
                    <DueServiceChip name={service.name} />
                  </div>
                  <div className="serviceArtistPick">
                    <button
                      type="button"
                      className={`serviceArtistPickBtn${artistLabel ? " hasArtist" : ""}`}
                      aria-label={artistLabel ? `آرتیست‌ها: ${artistLabel}` : "انتخاب آرتیست‌ها"}
                      aria-expanded={menuOpen}
                      aria-haspopup="listbox"
                      title={artistLabel || "انتخاب آرتیست‌ها"}
                      onClick={() => onMenuToggle?.(menuOpen ? null : service.id)}
                    >
                      <span className={`serviceArtistStack${visibleArtists.length ? "" : " is-empty"}`} aria-hidden="true">
                        {visibleArtists.length ? (
                          visibleArtists.slice(0, 2).map((person) => {
                            const avatar = person.avatar || person.staff_avatar || "";
                            return (
                              <span className={`serviceArtistAvatar ${avatar ? "hasImage" : ""}`} key={person.id || person.name}>
                                {avatar ? <img src={avatar} alt="" /> : String(person.name || "آ").slice(0, 1)}
                              </span>
                            );
                          })
                        ) : (
                          <span className="serviceArtistAvatar is-icon">
                            <UserRound size={14} />
                          </span>
                        )}
                        {/* Beyond the first 2 avatars, show how many more are picked instead of a plain
                            "+" that never changed -- that static icon made it look like a 3rd (or 4th...)
                            selection was never registered, when it always was (see toggleSalonServiceArtist). */}
                        {visibleArtists.length > 2 ? (
                          <em>+{toPersianDigits(visibleArtists.length - 2)}</em>
                        ) : (
                          <span className="serviceArtistAvatar is-icon is-plus">
                            <Plus size={14} />
                          </span>
                        )}
                      </span>
                    </button>
                    <ProfileSheet
                      open={menuOpen}
                      kicker={selectedArtistIds.length ? `${toPersianDigits(selectedArtistIds.length)} آرتیست انتخاب شده` : "هنوز آرتیستی انتخاب نشده"}
                      title={service.name}
                      panelClassName="sasSheet"
                      onClose={() => onMenuToggle?.(null)}
                    >
                      <div className="sasBody" role="listbox" aria-label="لیست آرتیست‌ها" aria-multiselectable="true">
                        {staffList.length === 0 ? (
                          <p className="sasEmpty">هنوز کسی توی تیمت نیست. از «پرسنل» یه آرتیست دعوت کن، یا اگه خودت این کار رو می‌کنی «خودم هم کار می‌کنم» رو بزن.</p>
                        ) : (
                          <>
                            {/* Design sample (2026-11-08): the picked ones first, numbered, with arrows; the rest below.
                                The order is kept only on this screen for now (not saved). */}
                            {(() => {
                              const picked = orderedPicked(service.id, selectedArtistIds);
                              const others = staffList.filter((person) => !selectedArtistIds.includes(String(person.id)));
                              const row = (person, rank) => {
                                const selected = rank > 0;
                                const avatar = person.avatar || person.staff_avatar || "";
                                return (
                                  <div className={`sasLine${selected ? " is-selected" : ""}`} key={person.id || person.name}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      className={`sasRow${selected ? " is-selected" : ""}`}
                                      onClick={() => onToggleArtist?.(service, person.id)}
                                    >
                                      <span className={`sasAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
                                        {avatar ? <img src={avatar} alt="" /> : String(person.name || "آ").slice(0, 1)}
                                      </span>
                                      <span className="sasName">
                                        <b>{person.name}{person.is_owner ? " (خودم)" : ""}</b>
                                        <small>
                                          {person.role || person.artist_service || "آرتیست"}
                                          {autoIds.includes(String(person.id)) ? (
                                            <em className={`sasAuto${selected ? "" : " is-off"}`}>{selected ? "خودکار" : "برداشتی"}</em>
                                          ) : selected ? <em className="sasAuto is-manual">دستی</em> : null}
                                        </small>
                                      </span>
                                      <span className="sasCheck" aria-hidden="true">{selected ? toPersianDigits(rank) : null}</span>
                                    </button>
                                    {selected && picked.length > 1 ? (
                                      <span className="sasMove">
                                        <button type="button" disabled={rank === 1} aria-label={`بالاتر بردن ${person.name}`} onClick={() => moveArtist(service.id, picked, rank - 1, -1)}>
                                          <ChevronUp size={14} strokeWidth={3} />
                                        </button>
                                        <button type="button" disabled={rank === picked.length} aria-label={`پایین‌تر بردن ${person.name}`} onClick={() => moveArtist(service.id, picked, rank - 1, 1)}>
                                          <ChevronDown size={14} strokeWidth={3} />
                                        </button>
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              };
                              return (
                                <>
                                  {picked.map((id, index) => {
                                    const person = staffList.find((item) => String(item.id) === id);
                                    return person ? row(person, index + 1) : null;
                                  })}
                                  {others.length ? <p className="sasSplit">بقیهٔ تیم</p> : null}
                                  {others.map((person) => row(person, 0))}
                                </>
                              );
                            })()}
                            {selectedArtistIds.length ? (
                              <button type="button" className="sasClear" onClick={() => onClearArtists?.(service)}>
                                همه رو بردار
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </ProfileSheet>
                  </div>
                </div>
              </article>
            );
          }}</ServiceGroups>
        )}
      </div>
      <ProfileSheet
        open={Boolean(group)}
        kicker={group ? `${toPersianDigits(group.items.length)} خدمت` : ""}
        title={group ? `آرتیست‌های ${group.fa}` : ""}
        panelClassName="sasSheet"
        onClose={() => setGroupSheet(null)}
      >
        {group ? (
          <div className="sasBody" role="listbox" aria-label={`آرتیست‌های ${group.fa}`} aria-multiselectable="true">
            {staffList.map((person) => {
              const id = String(person.id);
              const count = group.items.filter((service) => idsOf(service).includes(id)).length;
              const all = count === group.items.length;
              const avatar = person.avatar || person.staff_avatar || "";
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={all}
                  className={`sasRow${all ? " is-selected" : count ? " is-some" : ""}`}
                  key={person.id || person.name}
                  onClick={() => toggleGroupArtist(person.id)}
                >
                  <span className={`sasAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
                    {avatar ? <img src={avatar} alt="" /> : String(person.name || "آ").slice(0, 1)}
                  </span>
                  <span className="sasName">
                    <b>{person.name}{person.is_owner ? " (خودم)" : ""}</b>
                    <small>{all ? "همهٔ خدمت‌ها" : count ? `${toPersianDigits(count)} از ${toPersianDigits(group.items.length)} خدمت` : person.role || person.artist_service || "آرتیست"}</small>
                  </span>
                  <span className="sasCheck" aria-hidden="true">{all ? <Check size={15} /> : count ? <Minus size={15} /> : null}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </ProfileSheet>
      {photoService ? (
        <ServicePhotosEditor
          service={services.find((item) => item.id === photoService.id) || photoService}
          onClose={() => setPhotoService(null)}
          onSaved={onPhotosChanged}
        />
      ) : null}
    </>
  );
}
