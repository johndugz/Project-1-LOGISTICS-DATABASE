/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare module '*.svg' {
  import type { ReactNode } from 'react';
  const content: () => ReactNode;
  export default content;
}
