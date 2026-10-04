"use client";

import { MapPin, Timer } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

const PERSIAN_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

/** Only what the artist actually entered: bio, area and real working hours. */
export function PublicArtistAboutPanel({ artist }) {
  if (!artist) return null;
  const hours = Array.isArray(artist.hours) ? artist.hours : [];
  const today = PERSIAN_WEEKDAYS[new Date().getDay()];

  return (
    <section className="artistPublicAbout" aria-label="درباره آرتیست">
      {artist.bio ? <p className="artistPublicAboutBio">{artist.bio}</p> : (
        <p className="artistPublicAboutBio is-empty">این آرتیست هنوز توضیحی دربارهٔ خودش ننوشته است.</p>
      )}

      <div className="artistPublicAboutList">
        {artist.area ? (
          <div>
            <MapPin size={16} />
            <div>
              <b>محدوده</b>
              <span>{artist.area}</span>
            </div>
          </div>
        ) : null}
        {hours.length ? (
          <div>
            <Timer size={16} />
            <div>
              <b>ساعات کاری</b>
              <ul className="spvAboutHours">
                {hours.map((row) => (
                  <li key={row.day} className={row.day === today ? "is-today" : ""}>
                    <span>{row.day}</span>
                    <span>{row.active ? `${toPersianDigits(row.open_time || "")} تا ${toPersianDigits(row.close_time || "")}` : "تعطیل"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
