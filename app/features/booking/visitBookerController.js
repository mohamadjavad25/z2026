import {
  MAX_VISIT_PEOPLE, buildSubmitBody, createState, maxServicesFor, pickedServices, readiness, sameTime, sanitizeSelection, sequentialPlan, submitFailure,
  toggleSelection, visitQuery, withDay, withPeople, withSelection, withStaff, withTime
} from "./visitBookerModel.js";
import { timeLabelToMinutes } from "../../shared/lib/time.js";

/** How many days after the chosen one the form searches for the first free hour. */
const LOOK_AHEAD_DAYS = 14;

/**
 * Everything that happens over time in the booking form, with no React in it so it can be tested
 * on its own: asking the server for free times and for the plan, throwing away answers that are
 * already out of date, moving to the nearest open day, and sending the booking once.
 *
 * `source.loadTimes({ day, services, fresh })` → { ok, times: string[] }; `fresh` is true when the
 *    list is being asked for again after something went wrong, so a source that keeps its own copy
 *    of the calendar should look again instead of trusting it
 * `source.loadPlan({ day, time, services, staff })` → { ok, data } (data: the preview endpoint's answer);
 *    leave it out and the plan is the services one after another (the independent artist's case).
 * `source.loadBackups({ day, time, services })` → { ok, salons: [{ id, name, area, avatar }] } (client only,
 *    optional): the salons that could take this request if the first one does not answer within the hour.
 * `source.loadDays({ days, services })` → { ok, days: [{ day, times }] } (client only, optional): the free times of the
 *    next two weeks at once, so each day of the step form can say how many it has (`dayCounts`).
 * `submit(body)` → { ok, status, payload }
 *
 * State is replaced, never changed, so a UI can subscribe to it (useSyncExternalStore).
 */
export function createVisitBookerController({
  role,
  services,
  days,
  source,
  submit,
  initial = {},
  /** Skip to the nearest open day when the first one has nothing free (until the person picks a day). */
  autoAdvance = true,
  /** Wait this long after the last change of services or people before counting the days again (taps come in bursts). */
  daysDelay = 0
}) {
  const isClient = role === "client";
  const dayValues = days.filter((day) => !day.closed).map((day) => day.value);
  const firstDay = initial.day && days.some((day) => day.value === initial.day) ? initial.day : (dayValues[0] || days[0]?.value || "");
  // A request asked again elsewhere keeps its group size (a client's form only).
  const firstPeople = isClient && Number.isInteger(initial.people) && initial.people >= 1 && initial.people <= MAX_VISIT_PEOPLE ? initial.people : 1;
  let model = createState({
    selected: sanitizeSelection(initial.selected, services, isClient ? maxServicesFor(firstPeople) : undefined),
    day: firstDay,
    name: initial.name || "",
    phone: initial.phone || ""
  });
  if (firstPeople > 1) model = withPeople(model, firstPeople, false);
  // For a client's form (owner's decisions 2026-10-22): a closed day says when the salon opens next, a day with nothing
  // free looks ahead for the first free hour (`ahead`), and a time taken while sending is offered the next one (`conflict`).
  const weekdayOf = (day) => day?.weekday || String(day?.label || "").split(" ")[0];
  let times = { status: "idle", list: [], note: "", ahead: null, closedNext: "" };
  let conflict = null;
  let plan = { status: "idle", parts: [], message: "", code: "", partIndex: -1 };
  let backups = { status: "idle", list: [] };
  let backupsRequest = 0;
  // How many free times each of the next two weeks has for the current picks (client's step form).
  let dayCounts = { status: "idle", byDay: {}, first: null };
  let dayLists = {}; // the times behind each count, to name the first free time
  let daysRequest = 0;
  let submitting = false;
  let done = false;
  let tried = false;
  let error = "";
  let limitHit = false;
  let dayTouched = false;
  let disposed = false;
  let timesRequest = 0;
  let planRequest = 0;
  let snapshot = null;
  // An hour asked for beforehand (an unanswered request tried at another place): picked when that day has it, else the first.
  let preferTime = isClient ? String(initial.time || "") : "";
  const listeners = new Set();

  const list = () => pickedServices(model.selected, services);
  const hasPlanSource = typeof source.loadPlan === "function";
  const hasBackupSource = role === "client" && typeof source.loadBackups === "function";
  const hasDaysSource = isClient && typeof source.loadDays === "function";
  // The days counted: the open ones among the first two weeks of the list (owner's decision of 2026-11-02).
  const countedDays = days.slice(0, LOOK_AHEAD_DAYS).filter((day) => !day.closed).map((day) => day.value);

  function build() {
    const picked = list();
    const localPlan = !hasPlanSource && model.time && picked.length
      ? { status: "ok", parts: sequentialPlan(model.time, picked), message: "", code: "", partIndex: -1 }
      : plan;
    const effectivePlan = !model.time || !picked.length ? { status: "idle", parts: [], message: "", code: "", partIndex: -1 } : localPlan;
    const ready = readiness(role, model, picked, effectivePlan);
    snapshot = {
      ...model,
      picked,
      times,
      plan: effectivePlan,
      backups,
      dayCounts,
      readiness: ready,
      submitting,
      done,
      tried,
      error,
      limitHit,
      conflict
    };
    return snapshot;
  }
  const emit = () => {
    if (disposed) return;
    build();
    listeners.forEach((listener) => listener());
  };
  build();

  async function loadTimesFor(day, picked, fresh = false) {
    const request = ++timesRequest;
    const query = visitQuery(model, picked);
    let answer;
    try {
      answer = await source.loadTimes({ day, services: query.services, fresh, ...(query.people ? { people: query.people } : {}) });
    } catch {
      answer = { ok: false };
    }
    if (disposed || request !== timesRequest) return null; // out of date: the picks changed while it was out
    return answer?.ok && Array.isArray(answer.times) ? answer.times : false;
  }

  /** Free times for the current day and services; picks the first when the chosen one is not among them
   *  (`noPick`: leave the time empty instead, so a time that was just taken never turns into another one unasked). */
  async function refreshTimes({ keepNote = false, fresh = false, noPick = false } = {}) {
    const picked = list();
    if (!picked.length || !model.day) {
      timesRequest += 1;
      times = { status: "idle", list: [], note: "", ahead: null, closedNext: "" };
      model = withTime(model, "");
      resetPlan();
      emit();
      return;
    }
    const startDay = model.day;
    const dayIndex = days.findIndex((item) => item.value === startDay);
    // A closed day (the client form lets her tap it): say so and when the salon is open next, ask nothing.
    if (isClient && days[dayIndex]?.closed) {
      timesRequest += 1;
      const next = days.slice(dayIndex + 1).find((item) => !item.closed);
      times = { status: "closed", list: [], note: "", ahead: null, closedNext: next ? weekdayOf(next) : "" };
      model = withTime(model, "");
      resetPlan();
      emit();
      return;
    }
    times = { status: "loading", list: [], note: keepNote ? times.note : "", ahead: null, closedNext: "" };
    emit();
    let result = await loadTimesFor(startDay, picked, fresh);
    if (result === null) return;
    if (result === false) {
      times = { status: "error", list: [], note: "", ahead: null, closedNext: "" };
      model = withTime(model, "");
      resetPlan();
      emit();
      return;
    }
    let note = "";
    let scanned = false;
    if (!result.length && autoAdvance && !dayTouched) {
      const later = days.filter((day) => !day.closed && days.findIndex((item) => item.value === day.value) > days.findIndex((item) => item.value === startDay));
      for (const day of later) {
        const next = await loadTimesFor(day.value, picked, fresh);
        if (next === null) return;
        if (next === false) break;
        if (next.length) {
          model = withDay(model, day.value);
          result = next;
          note = "advanced";
          break;
        }
      }
      scanned = !result.length; // every later day was just asked and none has an hour: no need to look again
    }
    applyTimes(result, note, noPick);
    if (isClient && !result.length) {
      if (scanned) {
        times = { ...times, ahead: { status: "none" } };
        emit();
      } else void lookAhead(picked, fresh);
    }
  }

  /** The chosen day has nothing free: look through the days after it (up to the end of the list) for the first free hour. */
  async function lookAhead(picked, fresh) {
    const from = days.findIndex((item) => item.value === model.day);
    times = { ...times, ahead: { status: "loading" } };
    emit();
    // At most the next two weeks (owner's decision of 2026-10-22), however long the list of days is.
    for (const day of days.slice(from + 1, from + 1 + LOOK_AHEAD_DAYS)) {
      if (day.closed) continue;
      const next = await loadTimesFor(day.value, picked, fresh);
      if (next === null || disposed) return; // null: the picks changed meanwhile (a newer question was asked)
      if (next === false) break;
      if (next.length) {
        times = { ...times, ahead: { status: "found", day: day.value, label: day.label, time: next[0] } };
        emit();
        return;
      }
    }
    times = { ...times, ahead: { status: "none" } };
    emit();
  }

  function applyTimes(result, note = "", noPick = false) {
    times = { status: "ready", list: result, note, ahead: null, closedNext: "" };
    noteDayCount(model.day, result);
    const keep = model.time && result.some((time) => sameTime(time, model.time));
    const asked = preferTime;
    const wanted = !keep && asked ? result.find((time) => sameTime(time, asked)) : "";
    preferTime = "";
    if (wanted) model = withTime(model, wanted);
    // A time that was asked for and is gone is never swapped for another one the person did not pick.
    else if (!keep) model = withTime(model, noPick || asked ? "" : (result[0] || ""));
    resetPlan();
    emit();
    if (model.time) void refreshPlan();
    void refreshBackups();
  }

  /** The backup salons for the chosen services and time, asked for only once the client picks the hour.
   *  A backup that is no longer among them is let go. */
  async function refreshBackups() {
    const picked = list();
    const request = ++backupsRequest;
    if (!hasBackupSource || model.wait !== "hour" || !model.time || !picked.length || (model.people > 1 && !model.chain)) {
      backups = { status: "idle", list: [] };
      if (model.backup && model.wait === "hour") model = { ...model, backup: "" };
      emit();
      return;
    }
    backups = { status: "loading", list: backups.list };
    emit();
    let answer;
    try {
      answer = await source.loadBackups({ day: model.day, time: model.time, services: visitQuery(model, picked).services });
    } catch {
      answer = { ok: false };
    }
    if (disposed || request !== backupsRequest) return;
    const found = answer?.ok && Array.isArray(answer.salons) ? answer.salons : [];
    backups = { status: "ready", list: found };
    if (model.backup && !found.some((salon) => String(salon.id) === String(model.backup))) model = { ...model, backup: "" };
    emit();
  }

  /** The earliest counted day with a free time, and that time. */
  function firstFree(byDay) {
    const day = countedDays.find((value) => byDay[value] > 0);
    return day ? { day, time: dayLists[day]?.[0] || "" } : null;
  }

  /** Asks the free times of the next two weeks for the current picks, to count them per day. */
  async function refreshDayCounts(fresh = false) {
    if (!hasDaysSource) return;
    const picked = list();
    const request = ++daysRequest;
    if (!picked.length || !countedDays.length) {
      dayCounts = { status: "idle", byDay: {}, first: null };
      dayLists = {};
      emit();
      return;
    }
    dayCounts = { status: "loading", byDay: dayCounts.byDay, first: null };
    emit();
    const query = visitQuery(model, picked);
    let answer;
    try {
      answer = await source.loadDays({ days: countedDays, services: query.services, fresh, ...(query.people ? { people: query.people } : {}) });
    } catch {
      answer = { ok: false };
    }
    if (disposed || request !== daysRequest) return;
    if (!answer?.ok || !Array.isArray(answer.days)) {
      dayCounts = { status: "error", byDay: {}, first: null };
      dayLists = {};
      emit();
      return;
    }
    const byDay = {};
    const lists = {};
    for (const item of answer.days) {
      if (!countedDays.includes(item?.day) || !Array.isArray(item.times)) continue;
      byDay[item.day] = item.times.length;
      lists[item.day] = item.times;
    }
    dayLists = lists;
    dayCounts = { status: "ready", byDay, first: firstFree(byDay) };
    emit();
  }

  let daysTimer = null;
  /** After a tap on a service or the people count: the counts wait for the taps to stop, and look stale meanwhile. */
  function queueDayCounts() {
    if (daysTimer) clearTimeout(daysTimer);
    daysTimer = null;
    if (!daysDelay || !hasDaysSource) return void refreshDayCounts();
    daysRequest += 1;
    dayCounts = { status: "loading", byDay: dayCounts.byDay, first: null };
    daysTimer = setTimeout(() => {
      daysTimer = null;
      if (!disposed) void refreshDayCounts();
    }, daysDelay);
  }

  /** A day's times were just asked on their own: its count follows, so the day and its times never disagree. */
  function noteDayCount(day, result) {
    if (!hasDaysSource || dayCounts.status !== "ready" || !countedDays.includes(day)) return;
    const byDay = { ...dayCounts.byDay, [day]: result.length };
    dayLists = { ...dayLists, [day]: result };
    dayCounts = { ...dayCounts, byDay, first: firstFree(byDay) };
  }

  function resetPlan() {
    planRequest += 1;
    plan = { status: "idle", parts: [], message: "", code: "", partIndex: -1 };
  }

  async function refreshPlan() {
    if (!hasPlanSource) return;
    const picked = list();
    if (!model.time || !picked.length) {
      resetPlan();
      emit();
      return;
    }
    const request = ++planRequest;
    plan = { status: "loading", parts: plan.parts, message: "", code: "", partIndex: -1 };
    emit();
    const query = visitQuery(model, picked, { withStaff: role === "salon" });
    let answer;
    try {
      answer = await source.loadPlan({ day: model.day, time: model.time, services: query.services, staff: query.staff, ...(query.people ? { people: query.people } : {}) });
    } catch {
      answer = { ok: false };
    }
    if (disposed || request !== planRequest) return;
    const data = answer?.ok ? answer.data : null;
    if (!data || !Array.isArray(data.parts) || typeof data.ok !== "boolean") {
      plan = { status: "error", parts: [], message: "", code: "", partIndex: -1 };
    } else if (data.ok) {
      plan = { status: "ok", parts: data.parts, message: "", code: "", partIndex: -1 };
    } else {
      plan = { status: "problem", parts: data.parts, message: String(data.message || ""), code: String(data.code || ""), partIndex: Number.isInteger(data.partIndex) ? data.partIndex : -1 };
    }
    emit();
    // The slot itself is no longer fine (someone booked it, the hour went by): ask for fresh times once.
    if (plan.status === "problem" && ["NO_FREE_ARTIST", "CONFLICT", "SLOT_PAST", "TOO_SOON", "OUTSIDE_HOURS"].includes(plan.code) && !reloadedFor.has(`${model.day}|${model.time}`)) {
      reloadedFor.add(`${model.day}|${model.time}`);
      void refreshTimes({ fresh: true, noPick: isClient });
    }
  }
  const reloadedFor = new Set();

  const controller = {
    getState: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      disposed = false;
      void refreshTimes();
      void refreshDayCounts(); // at once
    },
    /** Answers still on their way are dropped. Safe to call and then start() again (React runs effects twice in development). */
    dispose() {
      disposed = true;
      timesRequest += 1;
      planRequest += 1;
      backupsRequest += 1;
      daysRequest += 1;
      if (daysTimer) clearTimeout(daysTimer);
      daysTimer = null;
    },

    toggleService(key) {
      if (submitting || done) return;
      const result = toggleSelection(model.selected, key, services, isClient ? maxServicesFor(model.people) : undefined);
      limitHit = result.limited;
      error = "";
      if (result.limited) return emit();
      model = { ...withSelection(model, result.keys), people: model.people, chain: model.chain };
      conflict = null;
      reloadedFor.clear();
      emit();
      void refreshTimes();
      queueDayCounts();
    },
    setDay(day) {
      if (submitting || done || !days.some((item) => item.value === day && (isClient || !item.closed)) || day === model.day) return;
      dayTouched = true;
      error = "";
      conflict = null;
      model = withDay(model, day);
      reloadedFor.clear();
      emit();
      void refreshTimes();
    },
    setTime(time) {
      if (submitting || done || !times.list.some((item) => sameTime(item, time)) || sameTime(model.time, time)) return;
      error = "";
      conflict = null;
      model = withTime(model, times.list.find((item) => sameTime(item, time)));
      resetPlan();
      emit();
      void refreshPlan();
      void refreshBackups();
    },
    /** «برای چند نفر؟»: 1 to 3 people at the same time (a client's request). Services beyond what fits are dropped from the end. */
    setPeople(count) {
      const people = Math.floor(Number(count));
      if (!isClient || submitting || done || !(people >= 1 && people <= MAX_VISIT_PEOPLE) || (people === model.people && !model.chain)) return;
      error = "";
      conflict = null;
      limitHit = false;
      const max = maxServicesFor(people);
      model = withPeople({ ...model, selected: model.selected.slice(0, max) }, people, false);
      reloadedFor.clear();
      emit();
      void refreshTimes();
      queueDayCounts();
    },
    /** «آره، پشت‌سرهم»: nobody is free together, so the same people go one after another (one ordinary visit). */
    chainPeople() {
      if (!isClient || submitting || done || model.people < 2 || model.chain) return;
      error = "";
      conflict = null;
      model = withPeople(model, model.people, true);
      reloadedFor.clear();
      emit();
      void refreshTimes();
      queueDayCounts();
    },
    /** «زودترین وقت خالی»: that day, with that hour chosen as soon as the day's times are in. */
    pickSoonest() {
      const first = dayCounts.first;
      if (!first || submitting || done) return false;
      if (first.day === model.day) {
        if (times.status === "loading") {
          preferTime = first.time || "";
          return true;
        }
        if (!first.time || !times.list.some((item) => sameTime(item, first.time))) return false;
        if (!sameTime(model.time, first.time)) controller.setTime(first.time);
        return true;
      }
      preferTime = first.time || "";
      controller.setDay(first.day);
      return true;
    },
    /** «همین ۱۸:۰۰ رو می‌خوام»: the one time left after the chosen one was taken. */
    takeTime(time) {
      conflict = null;
      controller.setTime(time);
      emit();
    },
    retryDays() {
      void refreshDayCounts(true);
    },
    /** «برو به آن روز»: the first free hour found ahead. */
    goToAhead() {
      const ahead = times.ahead;
      if (ahead?.status !== "found") return;
      controller.setDay(ahead.day);
    },
    /** The 409 card's «بله، ارسال»: the next free hour of that day is taken and sent. */
    async acceptConflict() {
      if (!conflict?.next || submitting || done) return { ok: false, reason: "busy" };
      const next = conflict.next;
      conflict = null;
      model = withTime(model, next);
      resetPlan();
      emit();
      await refreshPlan();
      return controller.submit();
    },
    /** The 409 card's «ساعت دیگر»: back to the day's list with nothing chosen. */
    dismissConflict() {
      conflict = null;
      emit();
    },
    /** The client's choice: "open" (wait until the appointment) or "hour". */
    setWait(wait) {
      if (role !== "client" || submitting || done || !["open", "hour"].includes(wait) || wait === model.wait) return;
      model = { ...model, wait };
      emit();
      void refreshBackups();
    },
    /** The backup salon's id ("" = none). Only one the server offered may be picked. */
    setBackup(id) {
      if (role !== "client" || submitting || done) return;
      const value = id ? String(id) : "";
      if (value && !backups.list.some((salon) => String(salon.id) === value)) return;
      model = { ...model, backup: value };
      emit();
    },
    setName(name) {
      model = { ...model, name: String(name ?? "") };
      emit();
    },
    setPhone(phone) {
      model = { ...model, phone: String(phone ?? "") };
      emit();
    },
    /** The salon names who does service number `index` ("" = the system's pick). */
    setStaff(index, name) {
      if (role !== "salon" || submitting || done) return;
      model = withStaff(model, index, String(name || ""));
      error = "";
      emit();
      void refreshPlan();
    },
    retryTimes() {
      void refreshTimes({ fresh: true });
    },
    retryPlan() {
      void refreshPlan();
    },

    /** Sends the booking. Resolves { ok, reason?, message? }; a second call while one is out does nothing. */
    async submit() {
      if (submitting || done) return { ok: false, reason: "busy" };
      tried = true;
      const state = build();
      if (!state.readiness.ok) {
        emit();
        return { ok: false, reason: state.readiness.reason, missing: state.readiness.missing, message: state.readiness.message || "" };
      }
      submitting = true;
      error = "";
      emit();
      let result;
      try {
        const body = buildSubmitBody(role, model, state.picked, state.plan.parts);
        // The backup's name rides along for the screen that follows (the server reads only the id).
        const backupSalon = body.fallbackSalonUserId ? backups.list.find((salon) => String(salon.id) === String(body.fallbackSalonUserId)) : null;
        if (backupSalon) body.fallbackName = backupSalon.name;
        result = await submit(body);
      } catch {
        result = { ok: false, status: 0, payload: {} };
      }
      if (disposed) return { ok: Boolean(result?.ok) };
      submitting = false;
      if (result?.ok) {
        done = true;
        emit();
        return { ok: true, result };
      }
      const failure = submitFailure(result || {});
      error = failure.message;
      if (isClient && failure.reloadTimes) {
        // The hour was taken while sending: look again, and never move to another hour unasked. A single person is
        // offered the next free hour of that day; a group's refusal already says the hours were refreshed.
        const taken = model.time;
        const code = result?.payload?.code || "";
        dayTouched = true; // the person is on this day: a refreshed empty list never moves them to another one
        await refreshTimes({ fresh: true, noPick: true });
        if (disposed) return { ok: false, reason: "refused", message: failure.message };
        if (code === "GROUP_FULL" || (model.people > 1 && !model.chain)) {
          emit();
        } else {
          const after = times.status === "ready" ? times.list.find((time) => timeLabelToMinutes(time) > timeLabelToMinutes(taken)) : "";
          error = "";
          conflict = { taken, next: after || "" };
          emit();
        }
        return { ok: false, reason: "refused", message: failure.message };
      }
      emit();
      if (failure.reloadTimes) void refreshTimes({ fresh: true });
      return { ok: false, reason: "refused", message: failure.message };
    }
  };
  return controller;
}
