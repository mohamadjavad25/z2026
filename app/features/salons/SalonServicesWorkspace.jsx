"use client";

import { Check, Plus, UserRound } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { Mascot } from "../../components/Mascot";
import { ProfileSheet } from "../profile/ProfileSheet";

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
  onEdit
}) {
  return (
    <>
      <div className="svcToolbar">
        <div>
          <span>خدمات</span>
          <b>منوی خدمات • {toPersianDigits(services.length)}</b>
        </div>
        <button type="button" className="svcAddBtn" onClick={onCreate}>
          <Plus size={16} />
          افزودن
        </button>
      </div>
      <div className="svcList salonServiceManagerList">
        {services.length === 0 ? (
          <ProfileEmptyState
            className="artistServiceEmpty"
            visual={<Mascot pose="hairstyle" size={140} />}
            title="هنوز خدمتی ثبت نشده"
            description="خدمت‌ها را تعریف کن تا مشتری بتواند روز، ساعت و آرتیست مناسب را انتخاب کند."
            actionLabel="افزودن اولین خدمت"
            onAction={onCreate}
          />
        ) : (
          services.map((service) => {
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
                <ServiceIcon emoji={service.emoji} name={service.name} size="xl" />
                <div className="svcCardBody">
                  <div className="svcCardTitle"><strong>{service.name}</strong></div>
                  {service.hint ? <p className="svcCardHint">{service.hint}</p> : null}
                  <div className="svcCardMeta">
                    <span className="svcChip is-price">{service.price ? `${formatTomanNumber(parseTomanAmount(service.price))} تومان` : "قیمت را تنظیم کن"}</span>
                    <span className="svcChip">{service.duration || "زمان را تنظیم کن"}</span>
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
                        <span className="serviceArtistAvatar is-icon is-plus">
                          <Plus size={14} />
                        </span>
                      </span>
                    </button>
                    <ProfileSheet
                      open={menuOpen}
                      kicker={selectedArtistIds.length ? `${toPersianDigits(selectedArtistIds.length)} آرتیست انتخاب شده` : "آرتیستی انتخاب نشده"}
                      title={service.name}
                      panelClassName="sasSheet"
                      onClose={() => onMenuToggle?.(null)}
                    >
                      <div className="sasBody" role="listbox" aria-label="لیست آرتیست‌ها" aria-multiselectable="true">
                        {staffList.length === 0 ? (
                          <p className="sasEmpty">هنوز پرسنلی ثبت نشده. از بخش پرسنل یک آرتیست دعوت کن، یا اگر خودت این کار را انجام می‌دهی «خودم هم کار می‌کنم» را بزن.</p>
                        ) : (
                          <>
                            <p className="sasHint">آرتیست‌هایی که تخصصشان به این خدمت می‌خورد خودکار وصل می‌شوند. هر کدام را نخواستی بردار، یا کس دیگری را اضافه کن؛ انتخابت حفظ می‌شود.</p>
                            {staffList.map((person) => {
                              const selected = selectedArtistIds.includes(String(person.id));
                              const avatar = person.avatar || person.staff_avatar || "";
                              return (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  className={`sasRow${selected ? " is-selected" : ""}`}
                                  key={person.id || person.name}
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
                                        <em className={`sasAuto${selected ? "" : " is-off"}`}>{selected ? "خودکار از تخصص" : "مرتبط؛ برداشته شده"}</em>
                                      ) : selected ? <em className="sasAuto is-manual">دستی</em> : null}
                                    </small>
                                  </span>
                                  <span className="sasCheck" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
                                </button>
                              );
                            })}
                            {selectedArtistIds.length ? (
                              <button type="button" className="sasClear" onClick={() => onClearArtists?.(service)}>
                                حذف همه آرتیست‌ها
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
          })
        )}
      </div>
    </>
  );
}
