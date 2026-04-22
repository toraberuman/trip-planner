import React from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;

export function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
            onClick={e => e.stopPropagation()}>
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
