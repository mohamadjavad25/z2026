"use client";

import { ShieldCheck } from "lucide-react";

/**
 * Salon owner — mock ops tool sheet.
 * Presentational: mock lists + notice callbacks (not wired from overview yet).
 */
export function SalonToolSheets({
  open,
  tool,
  inventory = [],
  tasks = [],
  onClose,
  onNotice
}) {
  if (!open || tool !== "ops") return null;

  return (
    <div className="salonToolModal" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="salonToolPanel salonToolWindow is-system" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modalClose" onClick={onClose}>×</button>
        {tool === "ops" && (
          <>
            <div className="toolPanelHead systemPanelHead">
              <div>
                <span>عملیات سالن</span>
                <b>موجودی و چک‌لیست امروز</b>
              </div>
              <small>{inventory.length} ماده · {tasks.length} کار</small>
            </div>
            <div className="systemHeroPanel opsHeroPanel">
              <div>
                <span>کنترل روزانه</span>
                <b>آماده‌سازی سالن قبل از شروع کار</b>
                <small>مواد مصرفی، کارهای مهم و وضعیت اجرایی امروز در یک پنجره.</small>
              </div>
              <strong>{tasks.length}</strong>
            </div>
            <div className="systemSplit opsSplit">
              <section>
                <div className="systemSectionHead">
                  <span>موجودی</span>
                  <b>مواد مصرفی</b>
                </div>
                <div className="inventoryList">
                  {inventory.map((item) => (
                    <span className={item.tone} key={item.item}><b>{item.item}</b>{item.level}</span>
                  ))}
                </div>
              </section>
              <section>
                <div className="systemSectionHead">
                  <span>کارها</span>
                  <b>چک‌لیست امروز</b>
                </div>
                <div className="taskList">
                  {tasks.map((task) => (
                    <span key={task}><ShieldCheck size={14} /> {task}</span>
                  ))}
                </div>
              </section>
            </div>
            <div className="opsQuickActions">
              <button type="button" onClick={() => onNotice?.("هشدار خرید مواد کم‌موجودی ثبت شد.")}>ثبت خرید مواد</button>
              <button type="button" onClick={() => onNotice?.("چک‌لیست امروز تکمیل شد.")}>تکمیل چک‌لیست</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
