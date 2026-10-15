/**
 * Art for the section / page icons (see PageIcon.jsx), drawn on a 32px grid.
 *
 * One family, one rule set: a 2px round ink outline plus up to two accent fills.
 *   .pi-s  outline        (stroke = --pi-ink)
 *   .pi-a  accent fill 1  (pink)
 *   .pi-b  accent fill 2  (violet)
 *   .pi-p  paper fill     (the page colour: white by day, ink by night)
 * Nothing here hard-codes a colour. The surrounding CSS (services.css) decides
 * the look: tabs are outline-only when idle and gain their accent fills when
 * active, so the same art reads in light and dark mode.
 */
const O = 'class="pi-s"';
const OA = 'class="pi-s pi-a"';
const OB = 'class="pi-s pi-b"';
const OP = 'class="pi-s pi-p"';

export const PAGE_ICON_ART = {
  // photo frame: sun and two hills
  posts: `<rect x="4.5" y="4.5" width="23" height="23" rx="7" ${OP}/><path d="M5.5 22.4 L12.2 16.6 L18 21.6 L21.6 18.6 L26.5 22.8 V21.6 Q26.5 26.5 21.6 26.5 H10.4 Q5.5 26.5 5.5 21.6Z" class="pi-b"/><circle cx="11.5" cy="12" r="2.6" ${OA}/><path d="M5 22.4 L12.2 16.2 L18 21.4 L21.6 18.4 L27 23" ${O}/>`,

  // storefront: scalloped awning over a door and a window
  salon: `<path d="M5.5 13 L7.8 5.5 H24.2 L26.5 13Z" ${OA}/><path d="M5.5 13 Q8.2 17 10.9 13 Q13.6 17 16.3 13 Q19 17 21.7 13 Q24.4 17 26.5 13" ${O}/><path d="M7.5 16 V26 Q7.5 27.5 9 27.5 H23 Q24.5 27.5 24.5 26 V16" ${OP}/><rect x="13" y="20" width="6" height="7.5" rx="1.6" ${OB}/>`,

  // profile: head and shoulders
  me: `<circle cx="16" cy="10.8" r="5.6" ${OA}/><path d="M5.5 27.5 Q5.5 18.8 16 18.8 Q26.5 18.8 26.5 27.5Z" ${OB}/>`,

  // team: a big and a small person side by side
  staff: `<circle cx="22.3" cy="11" r="4" ${OB}/><path d="M17.8 19.6 Q19.6 18.9 22.3 18.9 Q29.2 18.9 29.2 26.6" ${O}/><circle cx="12" cy="11.8" r="5.2" ${OA}/><path d="M3 27.6 Q3 19.6 12 19.6 Q21 19.6 21 27.6Z" ${OP}/>`,

  // service menu: a card with a header and three lines
  services: `<rect x="5.5" y="4" width="21" height="24" rx="5.5" ${OP}/><path d="M5.5 10.5 Q5.5 4 11 4 H21 Q26.5 4 26.5 10.5 V12 H5.5Z" ${OA}/><path d="M5.5 12 H26.5" ${O}/><circle cx="11.2" cy="18" r="1.4" ${OB}/><path d="M15.5 18 H21.5" ${O}/><circle cx="11.2" cy="23.2" r="1.4" ${OB}/><path d="M15.5 23.2 H21.5" ${O}/>`,

  // calendar with a confirmed check
  bookings: `<rect x="4.5" y="6" width="23" height="21.5" rx="6" ${OP}/><path d="M4.5 12 Q4.5 6 10.5 6 H21.5 Q27.5 6 27.5 12 V13.5 H4.5Z" ${OA}/><path d="M4.5 13.5 H27.5" ${O}/><path d="M10.8 3.5 V8.5 M21.2 3.5 V8.5" ${O}/><path d="M11.2 21 L14.6 24.2 L21 17.6" ${O}/>`,

  // partnership: two overlapping rings and a shared spark
  collab: `<circle cx="11.8" cy="16" r="8.2" ${OA}/><circle cx="20.2" cy="16" r="8.2" ${OB}/><path d="M16 8.7 A8.2 8.2 0 0 1 16 23.3 A8.2 8.2 0 0 1 16 8.7Z" class="pi-p"/><circle cx="11.8" cy="16" r="8.2" ${O}/><circle cx="20.2" cy="16" r="8.2" ${O}/>`,

  // settings: three sliders with knobs
  settings: `<path d="M5 9 H27 M5 16 H27 M5 23 H27" ${O}/><circle cx="20.5" cy="9" r="3.3" ${OA}/><circle cx="11.5" cy="16" r="3.3" ${OB}/><circle cx="21" cy="23" r="3.3" ${OA}/>`,

  // customers: a guest on each side of a bigger one in the middle
  customers: `<circle cx="6.8" cy="14.2" r="3.2" ${OB}/><path d="M1.8 26.4 Q1.8 19.8 6.8 19.8 Q9.2 19.8 10.6 20.9" ${O}/><circle cx="25.2" cy="14.2" r="3.2" ${OB}/><path d="M30.2 26.4 Q30.2 19.8 25.2 19.8 Q22.8 19.8 21.4 20.9" ${O}/><circle cx="16" cy="11.8" r="4.8" ${OA}/><path d="M7.6 27.6 Q7.6 19 16 19 Q24.4 19 24.4 27.6Z" ${OP}/>`,

  // discover: map pin with a heart in it
  discover: `<path d="M16 29.5 C9 21.8 5.5 17.6 5.5 12.8 A10.5 10.5 0 0 1 26.5 12.8 C26.5 17.6 23 21.8 16 29.5Z" ${OA}/><path d="M16 17.6 C12.6 15.4 11.7 12.8 13.5 11.8 C14.6 11.2 15.7 11.8 16 12.8 C16.3 11.8 17.4 11.2 18.5 11.8 C20.3 12.8 19.4 15.4 16 17.6Z" ${OP}/>`,

  // my activity: a ticket with a heart and a perforation
  activity: `<path d="M3.5 10 Q3.5 7.5 6 7.5 H26 Q28.5 7.5 28.5 10 V13 A3 3 0 0 0 28.5 19 V22 Q28.5 24.5 26 24.5 H6 Q3.5 24.5 3.5 22 V19 A3 3 0 0 0 3.5 13Z" ${OB}/><path d="M11 9.8 V22.2" class="pi-s" stroke-dasharray="1.6 3.4"/><path d="M20.2 20.2 C16.8 18 16 15.4 17.8 14.4 C18.9 13.8 20 14.4 20.2 15.4 C20.4 14.4 21.5 13.8 22.6 14.4 C24.4 15.4 23.6 18 20.2 20.2Z" ${OP}/>`,

  // quick-add booking: a calendar with a plus badge
  "booking-add": `<rect x="4.5" y="6" width="23" height="21.5" rx="6" ${OP}/><path d="M4.5 12 Q4.5 6 10.5 6 H21.5 Q27.5 6 27.5 12 V13.5 H4.5Z" ${OA}/><path d="M4.5 13.5 H27.5" ${O}/><path d="M10.8 3.5 V8.5 M21.2 3.5 V8.5" ${O}/><path d="M16 17 V24.6 M12.2 20.8 H19.8" ${O}/>`
};

export const PAGE_ICON_NAMES = Object.keys(PAGE_ICON_ART);
