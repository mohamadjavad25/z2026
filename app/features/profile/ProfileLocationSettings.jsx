"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronLeft, MapPin, Navigation, Search, X, Check, Locate } from "lucide-react";

const PROVINCES = [
  {
    name: "تهران", lat: 35.6892, lng: 51.3890,
    cities: [
      { name: "تهران", lat: 35.6892, lng: 51.3890 },
      { name: "اسلامشهر", lat: 35.5514, lng: 51.2350 },
      { name: "شهریار", lat: 35.6593, lng: 51.0591 },
      { name: "ورامین", lat: 35.3241, lng: 51.6461 },
      { name: "پاکدشت", lat: 35.4700, lng: 51.6842 },
      { name: "ملارد", lat: 35.6666, lng: 50.9764 },
      { name: "قدس", lat: 35.7053, lng: 51.1136 },
      { name: "بهارستان", lat: 35.5271, lng: 51.2966 },
      { name: "رباط‌کریم", lat: 35.4843, lng: 51.0830 },
      { name: "پردیس", lat: 35.7448, lng: 51.8190 },
      { name: "پیشوا", lat: 35.3068, lng: 51.7257 },
      { name: "قرچک", lat: 35.4397, lng: 51.5721 },
      { name: "دماوند", lat: 35.7023, lng: 52.0644 },
      { name: "فیروزکوه", lat: 35.7536, lng: 52.7714 },
      { name: "شمیرانات", lat: 35.8100, lng: 51.4634 },
      { name: "ری", lat: 35.5854, lng: 51.4395 },
    ]
  },
  {
    name: "البرز", lat: 35.8400, lng: 50.9391,
    cities: [
      { name: "کرج", lat: 35.8400, lng: 50.9391 },
      { name: "فردیس", lat: 35.7240, lng: 50.9840 },
      { name: "نظرآباد", lat: 35.9544, lng: 50.6097 },
      { name: "هشتگرد", lat: 35.9616, lng: 50.6820 },
      { name: "اشتهارد", lat: 35.7231, lng: 50.3580 },
      { name: "طالقان", lat: 36.1766, lng: 50.7612 },
      { name: "محمدشهر", lat: 35.7534, lng: 50.9071 },
      { name: "ماهدشت", lat: 35.7273, lng: 50.8171 },
      { name: "مشکین‌دشت", lat: 35.7670, lng: 50.9590 },
    ]
  },
  {
    name: "اصفهان", lat: 32.6546, lng: 51.6680,
    cities: [
      { name: "اصفهان", lat: 32.6546, lng: 51.6680 },
      { name: "خمینی‌شهر", lat: 32.7000, lng: 51.5214 },
      { name: "نجف‌آباد", lat: 32.6342, lng: 51.3668 },
      { name: "کاشان", lat: 33.9850, lng: 51.4100 },
      { name: "شاهین‌شهر", lat: 32.8617, lng: 51.5561 },
      { name: "فلاورجان", lat: 32.5589, lng: 51.5089 },
      { name: "مبارکه", lat: 32.3461, lng: 51.5064 },
      { name: "شهرضا", lat: 32.0025, lng: 51.8636 },
      { name: "سمیرم", lat: 31.4145, lng: 51.5713 },
      { name: "نائین", lat: 32.8586, lng: 53.0881 },
      { name: "اردستان", lat: 33.3760, lng: 52.3695 },
      { name: "تیران", lat: 32.7028, lng: 51.1534 },
      { name: "گلپایگان", lat: 33.4537, lng: 50.2886 },
      { name: "سپاهان‌شهر", lat: 32.6180, lng: 51.5700 },
      { name: "دولت‌آباد", lat: 32.8481, lng: 51.6656 },
      { name: "زرین‌شهر", lat: 32.3933, lng: 51.3772 },
      { name: "فریدون‌شهر", lat: 32.9419, lng: 50.1200 },
    ]
  },
  {
    name: "خراسان رضوی", lat: 36.2605, lng: 59.6168,
    cities: [
      { name: "مشهد", lat: 36.2605, lng: 59.6168 },
      { name: "نیشابور", lat: 36.2141, lng: 58.7962 },
      { name: "سبزوار", lat: 36.2126, lng: 57.6819 },
      { name: "تربت‌حیدریه", lat: 35.2740, lng: 59.2191 },
      { name: "قوچان", lat: 37.1064, lng: 58.5097 },
      { name: "کاشمر", lat: 35.2383, lng: 58.4649 },
      { name: "گناباد", lat: 34.3531, lng: 58.6836 },
      { name: "تربت‌جام", lat: 35.2440, lng: 60.6225 },
      { name: "چناران", lat: 36.6456, lng: 59.1212 },
      { name: "فریمان", lat: 35.7047, lng: 59.8511 },
      { name: "درگز", lat: 37.4409, lng: 59.1082 },
      { name: "خواف", lat: 34.5711, lng: 60.1414 },
      { name: "تایباد", lat: 34.7407, lng: 60.7756 },
      { name: "سرخس", lat: 36.5448, lng: 61.1582 },
      { name: "بردسکن", lat: 35.2606, lng: 57.9694 },
    ]
  },
  {
    name: "فارس", lat: 29.5918, lng: 52.5837,
    cities: [
      { name: "شیراز", lat: 29.5918, lng: 52.5837 },
      { name: "مرودشت", lat: 29.8745, lng: 52.8023 },
      { name: "جهرم", lat: 28.5008, lng: 53.5597 },
      { name: "فسا", lat: 28.9383, lng: 53.6483 },
      { name: "داراب", lat: 28.7520, lng: 54.5441 },
      { name: "لار", lat: 27.6826, lng: 54.3405 },
      { name: "کازرون", lat: 29.6197, lng: 51.6544 },
      { name: "آباده", lat: 31.1608, lng: 52.6505 },
      { name: "اقلید", lat: 30.8964, lng: 52.6831 },
      { name: "نورآباد ممسنی", lat: 30.1178, lng: 51.5306 },
      { name: "فیروزآباد", lat: 28.8439, lng: 52.5708 },
      { name: "لامرد", lat: 27.3400, lng: 53.1861 },
      { name: "سپیدان", lat: 30.2522, lng: 51.9900 },
      { name: "استهبان", lat: 29.1247, lng: 54.0453 },
    ]
  },
  {
    name: "آذربایجان شرقی", lat: 38.0800, lng: 46.2919,
    cities: [
      { name: "تبریز", lat: 38.0800, lng: 46.2919 },
      { name: "مراغه", lat: 37.3894, lng: 46.2383 },
      { name: "مرند", lat: 38.4322, lng: 45.7726 },
      { name: "میانه", lat: 37.4200, lng: 47.7150 },
      { name: "اهر", lat: 38.4717, lng: 47.0700 },
      { name: "بناب", lat: 37.3400, lng: 46.0561 },
      { name: "سراب", lat: 37.9381, lng: 47.5378 },
      { name: "شبستر", lat: 38.1803, lng: 45.7058 },
      { name: "هشترود", lat: 37.4736, lng: 47.0503 },
      { name: "بستان‌آباد", lat: 37.8475, lng: 46.8264 },
      { name: "جلفا", lat: 38.9411, lng: 45.6306 },
      { name: "ملکان", lat: 37.1472, lng: 46.1061 },
    ]
  },
  {
    name: "آذربایجان غربی", lat: 37.5527, lng: 45.0761,
    cities: [
      { name: "ارومیه", lat: 37.5527, lng: 45.0761 },
      { name: "خوی", lat: 38.5503, lng: 44.9522 },
      { name: "مهاباد", lat: 36.7631, lng: 45.7222 },
      { name: "بوکان", lat: 36.5211, lng: 46.2086 },
      { name: "میاندوآب", lat: 36.9694, lng: 46.1028 },
      { name: "پیرانشهر", lat: 36.6961, lng: 45.1414 },
      { name: "سلماس", lat: 38.1964, lng: 44.7700 },
      { name: "نقده", lat: 36.9531, lng: 45.3883 },
      { name: "سردشت", lat: 36.1568, lng: 45.4811 },
      { name: "تکاب", lat: 36.4006, lng: 47.1136 },
      { name: "شاهین‌دژ", lat: 36.6803, lng: 46.5672 },
      { name: "اشنویه", lat: 37.0386, lng: 45.1000 },
    ]
  },
  {
    name: "خوزستان", lat: 31.3183, lng: 48.6706,
    cities: [
      { name: "اهواز", lat: 31.3183, lng: 48.6706 },
      { name: "دزفول", lat: 32.3831, lng: 48.4017 },
      { name: "آبادان", lat: 30.3392, lng: 48.3043 },
      { name: "خرمشهر", lat: 30.4404, lng: 48.1661 },
      { name: "بندر ماهشهر", lat: 30.5597, lng: 49.1983 },
      { name: "شوشتر", lat: 32.0472, lng: 48.8567 },
      { name: "شوش", lat: 32.1942, lng: 48.2436 },
      { name: "بهبهان", lat: 30.5958, lng: 50.2417 },
      { name: "مسجدسلیمان", lat: 31.9364, lng: 49.3039 },
      { name: "ایذه", lat: 31.8336, lng: 49.8686 },
      { name: "اندیمشک", lat: 32.4600, lng: 48.3531 },
      { name: "رامهرمز", lat: 31.2692, lng: 49.6039 },
      { name: "امیدیه", lat: 30.7608, lng: 49.7047 },
      { name: "سوسنگرد", lat: 31.5583, lng: 48.1886 },
      { name: "هندیجان", lat: 30.2372, lng: 49.7128 },
    ]
  },
  {
    name: "گیلان", lat: 37.2808, lng: 49.5832,
    cities: [
      { name: "رشت", lat: 37.2808, lng: 49.5832 },
      { name: "لاهیجان", lat: 37.2094, lng: 50.0053 },
      { name: "لنگرود", lat: 37.1972, lng: 50.1533 },
      { name: "بندر انزلی", lat: 37.4694, lng: 49.4600 },
      { name: "آستارا", lat: 38.4294, lng: 48.8728 },
      { name: "تالش", lat: 37.8022, lng: 48.9078 },
      { name: "فومن", lat: 37.2244, lng: 49.3125 },
      { name: "صومعه‌سرا", lat: 37.3053, lng: 49.3217 },
      { name: "رودسر", lat: 37.1389, lng: 50.2903 },
      { name: "آستانه اشرفیه", lat: 37.2597, lng: 49.9442 },
      { name: "رودبار", lat: 36.8133, lng: 49.4906 },
      { name: "ماسال", lat: 37.3622, lng: 49.1306 },
      { name: "سیاهکل", lat: 37.1519, lng: 49.8700 },
    ]
  },
  {
    name: "مازندران", lat: 36.5633, lng: 53.0601,
    cities: [
      { name: "ساری", lat: 36.5633, lng: 53.0601 },
      { name: "بابل", lat: 36.5514, lng: 52.6794 },
      { name: "آمل", lat: 36.4697, lng: 52.3508 },
      { name: "قائم‌شهر", lat: 36.4642, lng: 52.8611 },
      { name: "بابلسر", lat: 36.7000, lng: 52.6556 },
      { name: "نوشهر", lat: 36.6497, lng: 51.4953 },
      { name: "چالوس", lat: 36.6556, lng: 51.4189 },
      { name: "تنکابن", lat: 36.8169, lng: 50.8781 },
      { name: "رامسر", lat: 36.9069, lng: 50.6575 },
      { name: "محمودآباد", lat: 36.6319, lng: 52.2614 },
      { name: "نور", lat: 36.5742, lng: 52.0203 },
      { name: "جویبار", lat: 36.6389, lng: 52.9083 },
      { name: "بهشهر", lat: 36.6942, lng: 53.5511 },
      { name: "نکا", lat: 36.6508, lng: 53.2994 },
    ]
  },
  {
    name: "کرمانشاه", lat: 34.3142, lng: 47.0650,
    cities: [
      { name: "کرمانشاه", lat: 34.3142, lng: 47.0650 },
      { name: "اسلام‌آباد غرب", lat: 34.1164, lng: 46.5231 },
      { name: "سنقر", lat: 34.7839, lng: 47.5986 },
      { name: "کنگاور", lat: 34.5042, lng: 47.9642 },
      { name: "هرسین", lat: 34.2722, lng: 47.5850 },
      { name: "صحنه", lat: 34.4817, lng: 47.6886 },
      { name: "جوانرود", lat: 34.8069, lng: 46.4925 },
      { name: "پاوه", lat: 35.0428, lng: 46.3567 },
      { name: "گیلانغرب", lat: 33.9761, lng: 45.9233 },
      { name: "سرپل ذهاب", lat: 34.4608, lng: 45.8625 },
      { name: "قصر شیرین", lat: 34.3161, lng: 45.5783 },
    ]
  },
  {
    name: "کرمان", lat: 30.2839, lng: 57.0834,
    cities: [
      { name: "کرمان", lat: 30.2839, lng: 57.0834 },
      { name: "رفسنجان", lat: 30.4067, lng: 55.9939 },
      { name: "سیرجان", lat: 29.4519, lng: 55.6828 },
      { name: "بم", lat: 29.1061, lng: 58.3569 },
      { name: "جیرفت", lat: 28.6764, lng: 57.7411 },
      { name: "زرند", lat: 30.8122, lng: 56.5622 },
      { name: "بافت", lat: 29.2333, lng: 56.5986 },
      { name: "بردسیر", lat: 29.9242, lng: 56.5725 },
      { name: "شهربابک", lat: 30.1158, lng: 55.1175 },
      { name: "کهنوج", lat: 27.9456, lng: 57.7025 },
      { name: "انار", lat: 30.8731, lng: 55.2697 },
    ]
  },
  {
    name: "هرمزگان", lat: 27.1865, lng: 56.2808,
    cities: [
      { name: "بندرعباس", lat: 27.1865, lng: 56.2808 },
      { name: "کیش", lat: 26.5580, lng: 53.9801 },
      { name: "قشم", lat: 26.9500, lng: 56.2711 },
      { name: "میناب", lat: 27.1050, lng: 57.0836 },
      { name: "بندر لنگه", lat: 26.5579, lng: 54.8806 },
      { name: "جاسک", lat: 25.6400, lng: 57.7700 },
      { name: "حاجی‌آباد", lat: 28.3097, lng: 55.9017 },
    ]
  },
  {
    name: "قم", lat: 34.6401, lng: 50.8764,
    cities: [
      { name: "قم", lat: 34.6401, lng: 50.8764 },
    ]
  },
  {
    name: "یزد", lat: 31.8974, lng: 54.3569,
    cities: [
      { name: "یزد", lat: 31.8974, lng: 54.3569 },
      { name: "میبد", lat: 32.2497, lng: 54.0164 },
      { name: "اردکان", lat: 32.3103, lng: 54.0178 },
      { name: "تفت", lat: 31.7461, lng: 54.2142 },
      { name: "مهریز", lat: 31.5914, lng: 54.4350 },
      { name: "بافق", lat: 31.6033, lng: 55.4014 },
      { name: "ابرکوه", lat: 31.1308, lng: 53.2911 },
    ]
  },
  {
    name: "همدان", lat: 34.7991, lng: 48.5150,
    cities: [
      { name: "همدان", lat: 34.7991, lng: 48.5150 },
      { name: "ملایر", lat: 34.2969, lng: 48.8231 },
      { name: "نهاوند", lat: 34.1908, lng: 48.3794 },
      { name: "تویسرکان", lat: 34.5528, lng: 48.4433 },
      { name: "اسدآباد", lat: 34.7808, lng: 48.1244 },
      { name: "بهار", lat: 34.9072, lng: 48.4408 },
      { name: "رزن", lat: 35.3897, lng: 49.0342 },
      { name: "کبودرآهنگ", lat: 35.2086, lng: 48.7225 },
    ]
  },
  {
    name: "لرستان", lat: 33.4878, lng: 48.3558,
    cities: [
      { name: "خرم‌آباد", lat: 33.4878, lng: 48.3558 },
      { name: "بروجرد", lat: 33.8972, lng: 48.7517 },
      { name: "دورود", lat: 33.4942, lng: 49.0583 },
      { name: "الیگودرز", lat: 33.4008, lng: 49.6939 },
      { name: "ازنا", lat: 33.4572, lng: 49.4525 },
      { name: "کوهدشت", lat: 33.5333, lng: 47.6069 },
      { name: "نورآباد", lat: 34.0731, lng: 47.9728 },
      { name: "پلدختر", lat: 33.1542, lng: 47.7136 },
      { name: "الشتر", lat: 33.8633, lng: 48.2536 },
    ]
  },
  {
    name: "سیستان و بلوچستان", lat: 29.4963, lng: 60.8629,
    cities: [
      { name: "زاهدان", lat: 29.4963, lng: 60.8629 },
      { name: "چابهار", lat: 25.2919, lng: 60.6428 },
      { name: "ایرانشهر", lat: 27.2025, lng: 60.6850 },
      { name: "زابل", lat: 31.0286, lng: 61.4953 },
      { name: "سراوان", lat: 27.3714, lng: 62.3361 },
      { name: "خاش", lat: 28.2211, lng: 61.2158 },
      { name: "نیکشهر", lat: 26.2222, lng: 60.2150 },
      { name: "کنارک", lat: 25.3547, lng: 60.3856 },
    ]
  },
  {
    name: "کردستان", lat: 35.3219, lng: 46.9862,
    cities: [
      { name: "سنندج", lat: 35.3219, lng: 46.9862 },
      { name: "سقز", lat: 36.2481, lng: 46.2686 },
      { name: "مریوان", lat: 35.5267, lng: 46.1769 },
      { name: "بانه", lat: 35.9975, lng: 45.8844 },
      { name: "قروه", lat: 35.1664, lng: 47.8039 },
      { name: "بیجار", lat: 35.8714, lng: 47.6114 },
      { name: "دهگلان", lat: 35.2722, lng: 47.4139 },
      { name: "کامیاران", lat: 34.7939, lng: 46.9344 },
      { name: "دیواندره", lat: 35.9167, lng: 47.0194 },
    ]
  },
  {
    name: "مرکزی", lat: 34.0917, lng: 49.6892,
    cities: [
      { name: "اراک", lat: 34.0917, lng: 49.6892 },
      { name: "ساوه", lat: 35.0222, lng: 50.3558 },
      { name: "خمین", lat: 33.6400, lng: 50.0792 },
      { name: "دلیجان", lat: 33.9911, lng: 50.6844 },
      { name: "محلات", lat: 33.9078, lng: 50.4519 },
      { name: "شازند", lat: 33.9333, lng: 49.4128 },
      { name: "تفرش", lat: 34.2069, lng: 50.0147 },
      { name: "آشتیان", lat: 34.5222, lng: 50.0064 },
      { name: "کمیجان", lat: 35.0053, lng: 49.3256 },
    ]
  },
  {
    name: "گلستان", lat: 36.8427, lng: 54.4439,
    cities: [
      { name: "گرگان", lat: 36.8427, lng: 54.4439 },
      { name: "گنبد کاووس", lat: 37.2500, lng: 55.1672 },
      { name: "علی‌آباد کتول", lat: 36.9072, lng: 54.8636 },
      { name: "آق‌قلا", lat: 37.0069, lng: 54.4553 },
      { name: "مینودشت", lat: 37.2358, lng: 55.3806 },
      { name: "کلاله", lat: 37.3803, lng: 55.4919 },
      { name: "بندر ترکمن", lat: 36.8919, lng: 54.0697 },
      { name: "آزادشهر", lat: 37.0886, lng: 55.1717 },
      { name: "رامیان", lat: 37.0194, lng: 55.1386 },
    ]
  },
  {
    name: "خراسان شمالی", lat: 37.4747, lng: 57.3290,
    cities: [
      { name: "بجنورد", lat: 37.4747, lng: 57.3290 },
      { name: "شیروان", lat: 37.3953, lng: 57.9250 },
      { name: "اسفراین", lat: 37.0739, lng: 57.5103 },
      { name: "جاجرم", lat: 36.9531, lng: 56.3778 },
      { name: "آشخانه", lat: 37.5603, lng: 56.9228 },
      { name: "فاروج", lat: 37.2250, lng: 58.2150 },
    ]
  },
  {
    name: "خراسان جنوبی", lat: 32.8663, lng: 59.2211,
    cities: [
      { name: "بیرجند", lat: 32.8663, lng: 59.2211 },
      { name: "قائن", lat: 33.7264, lng: 59.1847 },
      { name: "فردوس", lat: 34.0181, lng: 58.1711 },
      { name: "طبس", lat: 33.5986, lng: 56.9244 },
      { name: "نهبندان", lat: 31.5375, lng: 60.0375 },
      { name: "سربیشه", lat: 32.5756, lng: 59.7967 },
    ]
  },
  {
    name: "چهارمحال و بختیاری", lat: 32.3256, lng: 50.8645,
    cities: [
      { name: "شهرکرد", lat: 32.3256, lng: 50.8645 },
      { name: "بروجن", lat: 31.9694, lng: 51.2889 },
      { name: "لردگان", lat: 31.5211, lng: 50.8264 },
      { name: "فارسان", lat: 32.2536, lng: 50.5642 },
      { name: "سامان", lat: 32.4522, lng: 50.9106 },
      { name: "اردل", lat: 31.9856, lng: 50.6553 },
    ]
  },
  {
    name: "قزوین", lat: 36.2688, lng: 50.0041,
    cities: [
      { name: "قزوین", lat: 36.2688, lng: 50.0041 },
      { name: "تاکستان", lat: 36.0700, lng: 49.6936 },
      { name: "آبیک", lat: 36.0414, lng: 50.5353 },
      { name: "البرز", lat: 36.3239, lng: 49.9497 },
      { name: "بوئین‌زهرا", lat: 35.7681, lng: 50.0567 },
    ]
  },
  {
    name: "زنجان", lat: 36.6736, lng: 48.4787,
    cities: [
      { name: "زنجان", lat: 36.6736, lng: 48.4787 },
      { name: "ابهر", lat: 36.1467, lng: 49.2175 },
      { name: "خرمدره", lat: 36.2106, lng: 49.1953 },
      { name: "ماه‌نشان", lat: 36.7536, lng: 47.6686 },
    ]
  },
  {
    name: "سمنان", lat: 35.5769, lng: 53.3975,
    cities: [
      { name: "سمنان", lat: 35.5769, lng: 53.3975 },
      { name: "شاهرود", lat: 36.4182, lng: 54.9764 },
      { name: "دامغان", lat: 36.1683, lng: 54.3478 },
      { name: "گرمسار", lat: 35.2236, lng: 52.3406 },
      { name: "مهدی‌شهر", lat: 35.7189, lng: 53.3536 },
    ]
  },
  {
    name: "اردبیل", lat: 38.2498, lng: 48.2933,
    cities: [
      { name: "اردبیل", lat: 38.2498, lng: 48.2933 },
      { name: "مشگین‌شهر", lat: 38.3997, lng: 47.6844 },
      { name: "پارس‌آباد", lat: 39.6483, lng: 47.9175 },
      { name: "خلخال", lat: 37.6244, lng: 48.5247 },
      { name: "گرمی", lat: 39.0100, lng: 48.0800 },
      { name: "بیله‌سوار", lat: 39.3803, lng: 48.3472 },
      { name: "نمین", lat: 38.4297, lng: 48.4822 },
    ]
  },
  {
    name: "ایلام", lat: 33.6374, lng: 46.4227,
    cities: [
      { name: "ایلام", lat: 33.6374, lng: 46.4227 },
      { name: "دهلران", lat: 32.6919, lng: 47.2633 },
      { name: "ایوان", lat: 33.8283, lng: 46.3083 },
      { name: "مهران", lat: 33.1222, lng: 46.1750 },
      { name: "آبدانان", lat: 32.9933, lng: 47.4194 },
      { name: "دره‌شهر", lat: 33.1428, lng: 47.3781 },
    ]
  },
  {
    name: "بوشهر", lat: 28.9234, lng: 50.8203,
    cities: [
      { name: "بوشهر", lat: 28.9234, lng: 50.8203 },
      { name: "برازجان", lat: 29.2689, lng: 51.2108 },
      { name: "کنگان", lat: 27.8383, lng: 52.0608 },
      { name: "دیّر", lat: 27.8328, lng: 51.9342 },
      { name: "گناوه", lat: 29.5825, lng: 50.5194 },
      { name: "عسلویه", lat: 27.4750, lng: 52.6156 },
      { name: "جم", lat: 27.8297, lng: 52.3336 },
    ]
  },
  {
    name: "کهگیلویه و بویراحمد", lat: 30.6684, lng: 51.5880,
    cities: [
      { name: "یاسوج", lat: 30.6684, lng: 51.5880 },
      { name: "دوگنبدان", lat: 30.3589, lng: 50.7989 },
      { name: "دنا", lat: 30.8383, lng: 51.3958 },
      { name: "باشت", lat: 30.3622, lng: 51.1567 },
      { name: "لیکک", lat: 30.8928, lng: 50.1003 },
      { name: "چرام", lat: 30.7506, lng: 50.7444 },
    ]
  },
];

const ALL_CITIES = PROVINCES.flatMap((p) => p.cities);

const IRAN_CENTER = { lat: 32.4279, lng: 53.6880 };
const CITY_ZOOM = 13;
const PIN_ZOOM = 16;

export function ProfileLocationSettings({
  profileType,
  value,
  saving = false,
  onSave
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [pinPosition, setPinPosition] = useState(null);
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [step, setStep] = useState("province"); // province | city | pin
  const [locating, setLocating] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (value) setAddress(String(value));
  }, [value]);

  const filteredProvinces = useMemo(() => {
    if (!searchQuery.trim()) return PROVINCES;
    const q = searchQuery.trim();
    return PROVINCES.filter((p) =>
      p.name.includes(q) || p.cities.some((c) => c.name.includes(q))
    );
  }, [searchQuery]);

  const filteredCities = useMemo(() => {
    if (!selectedProvince) return [];
    if (!searchQuery.trim()) return selectedProvince.cities;
    const q = searchQuery.trim();
    return selectedProvince.cities.filter((c) => c.name.includes(q));
  }, [searchQuery, selectedProvince]);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const linkId = "leaflet-css-link";
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const center = selectedCity
        ? [selectedCity.lat, selectedCity.lng]
        : [IRAN_CENTER.lat, IRAN_CENTER.lng];
      const zoom = selectedCity ? CITY_ZOOM : 5;

      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "profileLocationMapPin",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#60519b" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="#60519b"/></svg>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      if (pinPosition) {
        markerRef.current = L.marker([pinPosition.lat, pinPosition.lng], { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          setPinPosition({ lat: pos.lat, lng: pos.lng });
          reverseGeocode(pos.lat, pos.lng);
        });
        map.setView([pinPosition.lat, pinPosition.lng], PIN_ZOOM);
      }

      map.on("click", (e) => {
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
        setPinPosition(pos);
        if (markerRef.current) {
          markerRef.current.setLatLng(pos);
        } else {
          markerRef.current = L.marker(pos, { icon: pinIcon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const p = markerRef.current.getLatLng();
            setPinPosition({ lat: p.lat, lng: p.lng });
            reverseGeocode(p.lat, p.lng);
          });
        }
        reverseGeocode(pos.lat, pos.lng);
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    });
  }, [selectedCity, pinPosition]);

  useEffect(() => {
    if (mapOpen && step === "pin") {
      initMap();
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [mapOpen, step]);

  async function reverseGeocode(lat, lng) {
    setReverseLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      if (data.address) {
        const parts = [];
        const a = data.address;
        if (a.city || a.town || a.village || a.state) parts.push(a.city || a.town || a.village || a.state);
        if (a.suburb || a.neighbourhood || a.quarter) parts.push(a.suburb || a.neighbourhood || a.quarter);
        if (a.road) parts.push(a.road);
        setAddress(parts.join("، ") || data.display_name || "");
      } else if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch {
      // keep current
    } finally {
      setReverseLoading(false);
    }
  }

  function pickProvince(province) {
    setSelectedProvince(province);
    setSearchQuery("");
    setStep("city");
  }

  function pickCity(city) {
    setSelectedCity(city);
    setSearchQuery("");
    setPinPosition({ lat: city.lat, lng: city.lng });
    setStep("pin");
  }

  function destroyMap() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }

  function openMap() {
    setMapOpen(true);
    setStep("province");
    setSearchQuery("");
  }

  function closeMap() {
    setMapOpen(false);
    setStep("province");
    setSearchQuery("");
    destroyMap();
  }

  function confirmLocation() {
    if (address) onSave?.(address);
    closeMap();
  }

  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPinPosition(coords);
        setLocating(false);
        const nearest = ALL_CITIES.reduce((best, c) => {
          const d = Math.abs(c.lat - coords.lat) + Math.abs(c.lng - coords.lng);
          return d < best.d ? { city: c, d } : best;
        }, { city: null, d: Infinity });
        if (nearest.city) {
          setSelectedCity(nearest.city);
          const prov = PROVINCES.find((p) => p.cities.some((c) => c.name === nearest.city.name));
          if (prov) setSelectedProvince(prov);
        }
        setStep("pin");
        reverseGeocode(coords.lat, coords.lng);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const hasAddress = Boolean(address);
  const breadcrumb = [
    selectedProvince?.name,
    selectedCity?.name
  ].filter(Boolean).join(" › ");

  return (
    <section className="profileLocationSettings" aria-label="ثبت لوکیشن" ref={panelRef}>
      {!mapOpen && (
        <button type="button" className="profileLocationRow" onClick={openMap}>
          <span className="profileLocationRowIcon" aria-hidden="true">
            <MapPin size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>ثبت لوکیشن</strong>
            <span>
              {hasAddress
                ? address
                : profileType === "salon" ? "روی نقشه محل سالن را مشخص کن" : "روی نقشه محل کارت رو مشخص کن"}
            </span>
          </span>
          {hasAddress ? (
            <span
              role="button"
              tabIndex={0}
              className="profileLocationRowClear"
              onClick={(e) => { e.stopPropagation(); setAddress(""); onSave?.(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setAddress(""); onSave?.(""); } }}
              aria-label="حذف لوکیشن"
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
          )}
        </button>
      )}

      {mapOpen && (
        <div className="profileLocationMapPanel">

          {/* مرحله ۱: انتخاب استان */}
          {step === "province" && (
            <div className="profileLocationCityStep">
              <div className="profileLocationPickerHead">
                <Search size={15} aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی استان یا شهر..."
                  autoComplete="off"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" className="profileLocationSearchClear" onClick={() => setSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
                <button type="button" className="profileLocationCloseBtn" onClick={closeMap} aria-label="بستن">
                  <X size={16} />
                </button>
              </div>

              <button type="button" className="profileLocationLocateMe" onClick={handleLocateMe} disabled={locating}>
                <Locate size={16} />
                <span>{locating ? "در حال پیدا کردن..." : "موقعیت فعلی من"}</span>
              </button>

              <div className="profileLocationCityList">
                <div className="profileLocationPickerHint">استان خود را انتخاب کنید</div>
                <div className="profileLocationPickerGrid">
                  {filteredProvinces.map((prov) => (
                    <button
                      type="button"
                      key={prov.name}
                      className={`profileLocationOption ${selectedProvince?.name === prov.name ? "is-active" : ""}`}
                      onClick={() => pickProvince(prov)}
                    >
                      <span>{prov.name}</span>
                      <small className="profileLocationOptionCount">{prov.cities.length}</small>
                    </button>
                  ))}
                  {filteredProvinces.length === 0 && (
                    <div className="profileLocationEmpty">استانی پیدا نشد</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* مرحله ۲: انتخاب شهر */}
          {step === "city" && (
            <div className="profileLocationCityStep">
              <div className="profileLocationPickerHead">
                <Search size={15} aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`جستجوی شهر در ${selectedProvince?.name}...`}
                  autoComplete="off"
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" className="profileLocationSearchClear" onClick={() => setSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
                <button type="button" className="profileLocationCloseBtn" onClick={closeMap} aria-label="بستن">
                  <X size={16} />
                </button>
              </div>

              <div className="profileLocationStepBar">
                <button type="button" className="profileLocationBack" onClick={() => { setStep("province"); setSearchQuery(""); }}>
                  <ChevronDown size={14} className="profileLocationBackIcon" />
                  تغییر استان
                </button>
                <span className="profileLocationSelectedCity">
                  <Navigation size={13} />
                  {selectedProvince?.name}
                </span>
              </div>

              <div className="profileLocationCityList">
                <div className="profileLocationPickerHint">شهر خود را انتخاب کنید</div>
                <div className="profileLocationPickerGrid">
                  {filteredCities.map((city) => (
                    <button
                      type="button"
                      key={city.name}
                      className={`profileLocationOption ${selectedCity?.name === city.name ? "is-active" : ""}`}
                      onClick={() => pickCity(city)}
                    >
                      <span>{city.name}</span>
                      {selectedCity?.name === city.name && <Check size={14} />}
                    </button>
                  ))}
                  {filteredCities.length === 0 && (
                    <div className="profileLocationEmpty">شهری پیدا نشد</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* مرحله ۳: نقشه */}
          {step === "pin" && (
            <div className="profileLocationPinStep">
              <div className="profileLocationMapBar">
                <button type="button" className="profileLocationBack" onClick={() => { setStep("city"); destroyMap(); }}>
                  <ChevronDown size={14} className="profileLocationBackIcon" />
                  تغییر شهر
                </button>
                <span className="profileLocationBreadcrumb">{breadcrumb}</span>
                <button type="button" className="profileLocationCloseBtn" onClick={closeMap} aria-label="بستن">
                  <X size={16} />
                </button>
              </div>

              <div className="profileLocationMapContainer" ref={mapContainerRef} />

              <div className="profileLocationMapFooter">
                <div className="profileLocationAddress">
                  <MapPin size={14} />
                  <span>{reverseLoading ? "در حال شناسایی آدرس..." : address || "روی نقشه بزن تا آدرس مشخص بشه"}</span>
                </div>
                <button
                  type="button"
                  className="profileLocationConfirm"
                  onClick={confirmLocation}
                  disabled={!address || saving}
                >
                  <Check size={16} />
                  {saving ? "در حال ذخیره..." : "تایید و ذخیره لوکیشن"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
