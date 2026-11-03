import { createContext, useContext } from "react";

interface ShellCtx {
  openCommand: () => void;
  openQuote: () => void;
}

export const ShellContext = createContext<ShellCtx>({
  openCommand: () => {},
  openQuote: () => {},
});

export const useShell = () => useContext(ShellContext);
