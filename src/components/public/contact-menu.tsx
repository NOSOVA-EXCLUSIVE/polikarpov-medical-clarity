"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function ContactMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key !== "Escape" || !menu?.open) return;
      const focusWasInside = menu.contains(document.activeElement);
      menu.open = false;
      if (focusWasInside) menu.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  return (
    <details
      ref={menuRef}
      className="site-contact-menu"
      onBlurCapture={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary>Связаться</summary>
      <nav
        className="site-contact-menu__links"
        aria-label="Организационная связь"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) {
            if (menuRef.current) menuRef.current.open = false;
          }
        }}
      >
        <a href="https://t.me/EvgeniyPolikarpov">Telegram</a>
        <a href="https://wa.me/79165821523">WhatsApp</a>
        <a href="mailto:medicalclarity@proton.me" aria-label="Написать на medicalclarity@proton.me">Email</a>
        <a href="https://www.instagram.com/polikarpovclarity/">Instagram</a>
      </nav>
    </details>
  );
}
