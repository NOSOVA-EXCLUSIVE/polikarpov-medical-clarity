"use client";

import { useId, type InputHTMLAttributes } from "react";

const timezoneOptions = [
  ["UTC", "Всемирное координированное время"],
  ["Europe/Kaliningrad", "Калининград"],
  ["Europe/Moscow", "Москва, Санкт-Петербург"],
  ["Europe/Samara", "Самара"],
  ["Asia/Yekaterinburg", "Екатеринбург"],
  ["Asia/Omsk", "Омск"],
  ["Asia/Krasnoyarsk", "Красноярск"],
  ["Asia/Irkutsk", "Иркутск"],
  ["Asia/Yakutsk", "Якутск"],
  ["Asia/Vladivostok", "Владивосток"],
  ["Asia/Magadan", "Магадан"],
  ["Asia/Kamchatka", "Петропавловск-Камчатский"],
  ["Europe/London", "Лондон"],
  ["Europe/Berlin", "Берлин, Париж, Рим"],
  ["Europe/Istanbul", "Стамбул"],
  ["Asia/Tbilisi", "Тбилиси"],
  ["Asia/Yerevan", "Ереван"],
  ["Asia/Dubai", "Дубай"],
  ["Asia/Almaty", "Алматы"],
  ["Asia/Bangkok", "Бангкок"],
  ["Asia/Shanghai", "Шанхай, Пекин"],
  ["Asia/Tokyo", "Токио"],
  ["America/New_York", "Нью-Йорк"],
  ["America/Los_Angeles", "Лос-Анджелес"]
] as const;

export function TimezoneInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "list">) {
  const uniqueId = useId();
  const listId = `timezone-options-${uniqueId}`;
  const noteId = `timezone-note-${uniqueId}`;
  const description = [props["aria-describedby"], noteId].filter(Boolean).join(" ");

  return (
    <>
      <input
        {...props}
        list={listId}
        placeholder={props.placeholder ?? "Выберите город или укажите часовой пояс"}
        autoComplete={props.autoComplete ?? "off"}
        aria-describedby={description}
      />
      <datalist id={listId}>
        {timezoneOptions.map(([value, label]) => (
          <option key={value} value={value} label={label} />
        ))}
      </datalist>
      <small id={noteId} className="questionnaire-field-note">
        Выберите город из подсказок или укажите свой часовой пояс.
      </small>
    </>
  );
}
