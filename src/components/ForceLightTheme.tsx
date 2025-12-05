import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

export const ForceLightTheme = ({ children }: { children: React.ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef<string | undefined>();

  useEffect(() => {
    previousTheme.current = theme;
    setTheme("light");

    return () => {
      if (previousTheme.current) {
        setTheme(previousTheme.current);
      }
    };
  }, []);

  return <>{children}</>;
};
