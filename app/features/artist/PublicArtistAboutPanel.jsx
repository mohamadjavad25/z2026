"use client";

import { MapPin, ShieldCheck, Timer } from "lucide-react";

export function PublicArtistAboutPanel({ artist }) {
  if (!artist) return null;

  return (
    <section className="artistPublicAbout" aria-label="درباره آرتیست">
      <p className="artistPublicAboutBio">
        {artist.bio
          || `${artist.role} با تمرکز روی کار تمیز، مشاوره صادقانه و نتیجه‌ای که در عکس و واقعیت یکی باشد.`}
      </p>

      <div className="artistPublicAboutList">
        <div>
          <MapPin size={16} />
          <div>
            <b>محدوده</b>
            <span>{artist.area || "ایران"} · آدرس بعد از تایید</span>
          </div>
        </div>
        <div>
          <Timer size={16} />
          <div>
            <b>ساعات کاری</b>
            <span>شنبه تا پنجشنبه · ۱۰:۰۰ تا ۲۰:۰۰</span>
          </div>
        </div>
        <div>
          <ShieldCheck size={16} />
          <div>
            <b>قوانین</b>
            <span>لغو رایگان تا ۱۲ ساعت قبل</span>
          </div>
        </div>
      </div>
    </section>
  );
}
