import React from "react";

export function onActivateKey(handler: () => void) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === "Enter") {
      handler();
    } else if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      handler();
    }
  };
}
