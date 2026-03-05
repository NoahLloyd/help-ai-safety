"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Language data with flag emojis ─────────────────────────

interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
  { code: "sq", name: "Albanian", flag: "🇦🇱" },
  { code: "am", name: "Amharic", flag: "🇪🇹" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hy", name: "Armenian", flag: "🇦🇲" },
  { code: "az", name: "Azerbaijani", flag: "🇦🇿" },
  { code: "eu", name: "Basque", flag: "🇪🇸" },
  { code: "be", name: "Belarusian", flag: "🇧🇾" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "bs", name: "Bosnian", flag: "🇧🇦" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
  { code: "my", name: "Burmese", flag: "🇲🇲" },
  { code: "ca", name: "Catalan", flag: "🇪🇸" },
  { code: "zh", name: "Chinese (Mandarin)", flag: "🇨🇳" },
  { code: "zh-yue", name: "Chinese (Cantonese)", flag: "🇭🇰" },
  { code: "hr", name: "Croatian", flag: "🇭🇷" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "et", name: "Estonian", flag: "🇪🇪" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "gl", name: "Galician", flag: "🇪🇸" },
  { code: "ka", name: "Georgian", flag: "🇬🇪" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "gu", name: "Gujarati", flag: "🇮🇳" },
  { code: "ht", name: "Haitian Creole", flag: "🇭🇹" },
  { code: "ha", name: "Hausa", flag: "🇳🇬" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "is", name: "Icelandic", flag: "🇮🇸" },
  { code: "ig", name: "Igbo", flag: "🇳🇬" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "ga", name: "Irish", flag: "🇮🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "jv", name: "Javanese", flag: "🇮🇩" },
  { code: "kn", name: "Kannada", flag: "🇮🇳" },
  { code: "kk", name: "Kazakh", flag: "🇰🇿" },
  { code: "km", name: "Khmer", flag: "🇰🇭" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ku", name: "Kurdish", flag: "🇮🇶" },
  { code: "ky", name: "Kyrgyz", flag: "🇰🇬" },
  { code: "lo", name: "Lao", flag: "🇱🇦" },
  { code: "lv", name: "Latvian", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" },
  { code: "lb", name: "Luxembourgish", flag: "🇱🇺" },
  { code: "mk", name: "Macedonian", flag: "🇲🇰" },
  { code: "mg", name: "Malagasy", flag: "🇲🇬" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "mt", name: "Maltese", flag: "🇲🇹" },
  { code: "mi", name: "Maori", flag: "🇳🇿" },
  { code: "mr", name: "Marathi", flag: "🇮🇳" },
  { code: "mn", name: "Mongolian", flag: "🇲🇳" },
  { code: "ne", name: "Nepali", flag: "🇳🇵" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "ps", name: "Pashto", flag: "🇦🇫" },
  { code: "fa", name: "Persian", flag: "🇮🇷" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "pt-br", name: "Portuguese (Brazilian)", flag: "🇧🇷" },
  { code: "pa", name: "Punjabi", flag: "🇮🇳" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "sm", name: "Samoan", flag: "🇼🇸" },
  { code: "sr", name: "Serbian", flag: "🇷🇸" },
  { code: "sn", name: "Shona", flag: "🇿🇼" },
  { code: "sd", name: "Sindhi", flag: "🇵🇰" },
  { code: "si", name: "Sinhala", flag: "🇱🇰" },
  { code: "sk", name: "Slovak", flag: "🇸🇰" },
  { code: "sl", name: "Slovenian", flag: "🇸🇮" },
  { code: "so", name: "Somali", flag: "🇸🇴" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "su", name: "Sundanese", flag: "🇮🇩" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
  { code: "tg", name: "Tajik", flag: "🇹🇯" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "tt", name: "Tatar", flag: "🇷🇺" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "ti", name: "Tigrinya", flag: "🇪🇷" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "tk", name: "Turkmen", flag: "🇹🇲" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "ur", name: "Urdu", flag: "🇵🇰" },
  { code: "uz", name: "Uzbek", flag: "🇺🇿" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "cy", name: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "xh", name: "Xhosa", flag: "🇿🇦" },
  { code: "yi", name: "Yiddish", flag: "🇮🇱" },
  { code: "yo", name: "Yoruba", flag: "🇳🇬" },
  { code: "zu", name: "Zulu", flag: "🇿🇦" },
];

// Build a lookup for quick name → Language resolution
const LANGUAGE_BY_NAME = new Map(LANGUAGES.map((l) => [l.name, l]));

// ─── Component ──────────────────────────────────────────────

interface LanguageSelectProps {
  value: string[];
  onChange: (languages: string[]) => void;
}

export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) &&
      !value.includes(l.name)
  );

  function addLanguage(name: string) {
    if (!value.includes(name)) {
      onChange([...value, name]);
    }
    setSearch("");
    inputRef.current?.focus();
  }

  function removeLanguage(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  // Resolve selected languages to their data (handle custom names gracefully)
  const selectedLanguages = value.map(
    (name) =>
      LANGUAGE_BY_NAME.get(name) || { code: name, name, flag: "🌐" }
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected pills + search input */}
      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex flex-wrap gap-1.5 rounded-xl border bg-card px-3 py-2.5 min-h-[48px] cursor-text transition-colors ${
          open
            ? "border-accent/50 ring-2 ring-accent/20"
            : "border-border hover:border-accent/30"
        }`}
      >
        {selectedLanguages.map((lang) => (
          <span
            key={lang.name}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 pl-2 pr-1 py-1 text-sm"
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="font-medium text-foreground">{lang.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeLanguage(lang.name);
              }}
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-muted hover:bg-accent/20 hover:text-foreground transition-colors cursor-pointer"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (
              e.key === "Backspace" &&
              search === "" &&
              value.length > 0
            ) {
              removeLanguage(value[value.length - 1]);
            }
            if (e.key === "Escape") {
              setOpen(false);
              setSearch("");
            }
          }}
          placeholder={value.length === 0 ? "Search languages..." : "Add more..."}
          className="flex-1 min-w-[120px] bg-transparent py-1 text-sm outline-none placeholder:text-muted"
        />
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 w-full max-h-[240px] overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted">
                {search
                  ? "No languages found"
                  : "All languages selected"}
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => addLanguage(lang.name)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 transition-colors cursor-pointer"
                  >
                    <span className="text-lg leading-none">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
