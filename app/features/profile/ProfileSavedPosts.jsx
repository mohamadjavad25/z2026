"use client";

import { useState } from "react";
import { BookmarkX, MapPin, Store, UserRound } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileEmptyState } from "./ProfileEmptyState";

function getSalonKey(salon) {
  return String(salon.id || salon.source_key || salon.name);
}

function getArtistKey(artist) {
  return String(artist.id || artist.name);
}

function getPostKey(item, index) {
  return String(item.id || item.image || item.title || index);
}

function getMosaicShape(ratio, index) {
  if (ratio >= 1.55) return "is-wide";
  if (ratio <= 0.72) return "is-tall";
  if (ratio >= 1.16) return "is-landscape";
  if (ratio <= 0.9) return "is-portrait";
  return index % 5 === 0 ? "is-featured" : "is-square";
}

export function ProfileSavedPosts({
  posts,
  salons = [],
  artists = [],
  onSelectPost,
  onRemovePost,
  onSelectSalon,
  onRemoveSalon,
  onSelectArtist,
  onRemoveArtist
}) {
  const hasSavedItems = posts.length || salons.length || artists.length;
  const [imageRatios, setImageRatios] = useState({});

  function rememberImageRatio(key, event) {
    const image = event.currentTarget;
    const ratio = image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 1;
    setImageRatios((items) => (items[key] === ratio ? items : { ...items, [key]: ratio }));
  }

  return (
    <div className="savedProfileContent">
      {salons.length ? (
        <section className="savedProfileGroup" aria-label="سالن‌های ذخیره‌شده">
          <div className="savedProfileGroupHead">
            <span>سالن‌های ذخیره‌شده</span>
            <b>{toPersianDigits(salons.length)} سالن</b>
          </div>
          <div className="savedSalonList">
            {salons.map((salon) => (
              <article
                className="savedSalonCard"
                key={getSalonKey(salon)}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSalon(salon)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSalon(salon);
                  }
                }}
              >
                <span className="savedSalonOpen">
                  <span className="savedSalonLogo">
                    {salon.avatar ? <img src={salon.avatar} alt="" /> : <Store size={20} />}
                  </span>
                  <span className="savedSalonBody">
                    <b>{salon.name}</b>
                    <small><MapPin size={13} /> {salon.area || "محدوده نامشخص"}</small>
                    <em>{toPersianDigits(salon.portfolio?.length || salon.post_count || 0)} نمونه‌کار</em>
                  </span>
                </span>
                <button
                  type="button"
                  className="savedSalonRemove"
                  aria-label="حذف سالن از ذخیره‌ها"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveSalon(salon);
                  }}
                >
                  <BookmarkX size={17} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {artists.length ? (
        <section className="savedProfileGroup" aria-label="آرتیست‌های ذخیره‌شده">
          <div className="savedProfileGroupHead">
            <span>آرتیست‌های ذخیره‌شده</span>
            <b>{toPersianDigits(artists.length)} آرتیست</b>
          </div>
          <div className="savedSalonList">
            {artists.map((artist) => (
              <article
                className="savedSalonCard"
                key={getArtistKey(artist)}
                role="button"
                tabIndex={0}
                onClick={() => onSelectArtist(artist)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectArtist(artist);
                  }
                }}
              >
                <span className="savedSalonOpen">
                  <span className="savedSalonLogo">
                    {artist.avatar ? <img src={artist.avatar} alt="" /> : <UserRound size={20} />}
                  </span>
                  <span className="savedSalonBody">
                    <b>{artist.name}</b>
                    <small><MapPin size={13} /> {artist.area || artist.role || "آرتیست مستقل"}</small>
                  </span>
                </span>
                <button
                  type="button"
                  className="savedSalonRemove"
                  aria-label="حذف آرتیست از ذخیره‌ها"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveArtist(artist);
                  }}
                >
                  <BookmarkX size={17} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {posts.length ? (
        <section className="savedProfileGroup" aria-label="پست‌های ذخیره‌شده">
          <div className="savedProfileGroupHead">
            <span>پست‌ها و مدل‌ها</span>
            <b>{toPersianDigits(posts.length)} مورد</b>
          </div>
          <div className="savedPostList">
            {posts.map((item, index) => {
              const key = getPostKey(item, index);
              const shape = getMosaicShape(imageRatios[key], index);
              return (
                <article
                  className={`savedPostCard ${shape} ${item.image ? "hasImage" : item.tile}`}
                  key={key}
                  onClick={() => onSelectPost(item)}
                  aria-label={`مشاهده ${item.title || "پست ذخیره‌شده"}`}
                >
                  {item.image ? <img src={item.image} alt="" onLoad={(event) => rememberImageRatio(key, event)} /> : null}
                  <button
                    type="button"
                    aria-label="حذف از ذخیره‌ها"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemovePost(item);
                    }}
                  >
                    <BookmarkX size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!hasSavedItems ? (
        <ProfileEmptyState
          className="emptySavedState"
          image="/saved-empty.png"
          title="هنوز چیزی ذخیره نشده"
          description="پست‌ها، مدل‌ها، سالن‌ها و آرتیست‌های ذخیره‌شده اینجا جمع می‌شوند."
        />
      ) : null}
    </div>
  );
}
