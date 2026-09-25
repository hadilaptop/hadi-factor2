import React, { useState } from "react";
import { toPersianDigits, toEnglishDigits } from "../utils/invoiceHelpers";
import * as jalaali from "jalaali-js";

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const WEEK_DAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

const yearsList = Array.from({ length: 20 }, (_, i) => 1395 + i);

function parseInitialDate(initialDate) {
  if (!initialDate) return { year: 1403, month: 1 };
  const engStr = toEnglishDigits(initialDate);
  const parts = engStr.split("/");
  if (parts.length === 3) {
    const y = parseInt(parts[0]) || 1403;
    const m = parseInt(parts[1]) || 1;
    return { year: y, month: Math.max(1, Math.min(12, m)) };
  }
  return { year: 1403, month: 1 };
}

export default function JalaliDatePickerModal({
  isOpen,
  initialDate,
  onSelectDate,
  onClose,
}) {
  const [prevInitialDate, setPrevInitialDate] = useState(initialDate);
  const [pickerYear, setPickerYear] = useState(() => parseInitialDate(initialDate).year);
  const [pickerMonth, setPickerMonth] = useState(() => parseInitialDate(initialDate).month);
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);
  const todayJalali = jalaali.toJalaali(new Date());
  const [isClosing, setIsClosing] = useState(false);

  if (initialDate !== prevInitialDate) {
    setPrevInitialDate(initialDate);
    const parsed = parseInitialDate(initialDate);
    setPickerYear(parsed.year);
    setPickerMonth(parsed.month);
    setIsYearMenuOpen(false);
    setIsMonthMenuOpen(false);
  }

  if (!isOpen) return null;

  const handleAnimatedClose = (cb) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      if (cb) cb();
      else onClose();
    }, 200);
  };

  const getMaxDaysInMonth = (y, m) => {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    return 29;
  };

  const handleSelectDay = (dayNumber) => {
    const yearStr = String(pickerYear);
    const monthStr = String(pickerMonth).padStart(2, "0");
    const dayStr = String(dayNumber).padStart(2, "0");
    const formattedPersian = toPersianDigits(`${yearStr}/${monthStr}/${dayStr}`);
    onSelectDate(formattedPersian);
    handleAnimatedClose();
  };

  return (
    <div className={`jalali-picker-overlay ${isClosing ? "is-closing" : ""}`} onClick={() => handleAnimatedClose()}>
      <div
        className="jalali-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jalali-picker-header">
          <h3>انتخاب تاریخ </h3>
          <button
            type="button"
            className="jalali-picker-close"
            onClick={() => handleAnimatedClose()}
          >
            ✕
          </button>
        </div>

        {/* انتخاب سال و ماه */}
        <div className="jalali-picker-selects">
          {/* دراپ‌داون سال */}
          <div className="custom-dropdown">
            <button
              type="button"
              className="jalali-select"
              onClick={() => {
                setIsYearMenuOpen(!isYearMenuOpen);
                setIsMonthMenuOpen(false);
              }}
            >
              {toPersianDigits(pickerYear)}
            </button>
            {isYearMenuOpen && (
              <div className="custom-dropdown-list">
                {yearsList.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      setPickerYear(y);
                      setIsYearMenuOpen(false);
                    }}
                  >
                    {toPersianDigits(y)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* دراپ‌داون ماه */}
          <div className="custom-dropdown">
            <button
              type="button"
              className="jalali-select"
              onClick={() => {
                setIsMonthMenuOpen(!isMonthMenuOpen);
                setIsYearMenuOpen(false);
              }}
            >
              {PERSIAN_MONTHS[pickerMonth - 1]}
            </button>
            {isMonthMenuOpen && (
              <div className="custom-dropdown-list">
                {PERSIAN_MONTHS.map((m, idx) => (
                  <button
                    key={idx + 1}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      setPickerMonth(idx + 1);
                      setIsMonthMenuOpen(false);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="jalali-days-grid">
          {WEEK_DAYS.map((wDay, i) => (
            <div key={wDay} className={`jalali-week-day ${i === 6 ? 'is-friday' : ''}`}>
              {wDay}
            </div>
          ))}
          {Array.from(
            { length: ((jalaali.toGregorian(pickerYear, pickerMonth, 1) && new Date(jalaali.toGregorian(pickerYear, pickerMonth, 1).gy, jalaali.toGregorian(pickerYear, pickerMonth, 1).gm - 1, jalaali.toGregorian(pickerYear, pickerMonth, 1).gd).getDay() + 1) % 7) },
            (_, i) => (
              <div key={`empty-${i}`} className="jalali-empty-day"></div>
            )
          )}
          {Array.from(
            { length: getMaxDaysInMonth(pickerYear, pickerMonth) },
            (_, i) => i + 1
          ).map((day) => {
            const firstDayOfWeek = (new Date(jalaali.toGregorian(pickerYear, pickerMonth, 1).gy, jalaali.toGregorian(pickerYear, pickerMonth, 1).gm - 1, jalaali.toGregorian(pickerYear, pickerMonth, 1).gd).getDay() + 1) % 7;
            const isFriday = (day + firstDayOfWeek - 1) % 7 === 6;
            const isToday = todayJalali.jy === pickerYear && todayJalali.jm === pickerMonth && todayJalali.jd === day;
            
            return (
              <button
                key={day}
                type="button"
                className={`jalali-day-btn ${isFriday ? 'is-friday-btn' : ''} ${isToday ? 'is-today-btn' : ''}`}
                onClick={() => {
                  handleSelectDay(day);
                  setIsYearMenuOpen(false);
                  setIsMonthMenuOpen(false);
                }}
              >
                {toPersianDigits(day)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
