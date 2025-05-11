"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface PlaceholdersAndVanishInputProps {
  placeholders: string[];
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
}

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  className = "",
}: PlaceholdersAndVanishInputProps) {
  const [placeholder, setPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState("");
  const [delta, setDelta] = useState(100 - Math.random() * 50);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ticker = setInterval(() => {
      tick();
    }, delta);

    return () => {
      clearInterval(ticker);
    };
  }, [placeholder, placeholderIndex, isDeleting]);

  const tick = () => {
    let currentPlaceholder = placeholders[placeholderIndex];
    let updatedPlaceholder = isDeleting
      ? currentPlaceholder.substring(0, placeholder.length - 1)
      : currentPlaceholder.substring(0, placeholder.length + 1);

    setPlaceholder(updatedPlaceholder);

    if (isDeleting) {
      setDelta((prevDelta) => prevDelta / 1.2);
    }

    if (!isDeleting && updatedPlaceholder === currentPlaceholder) {
      setIsDeleting(true);
      setDelta(800);
    } else if (isDeleting && updatedPlaceholder === "") {
      setIsDeleting(false);
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length);
      setDelta(300);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (text.trim() && onSubmit) {
      onSubmit(e);
      setText("");
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full relative max-w-3xl mx-auto ${className}`}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange && onChange(e);
          }}
          placeholder={placeholder}
          className="w-full bg-white dark:bg-[#1c1c1c] backdrop-blur-sm rounded-full border border-gray-200 dark:border-[#444] pl-4 pr-14 py-3 outline-none focus:ring-2 ring-indigo-600 text-base"
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          <Button
            type="submit"
            className="rounded-full w-10 h-10 p-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700"
            disabled={!text.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </form>
  );
}
