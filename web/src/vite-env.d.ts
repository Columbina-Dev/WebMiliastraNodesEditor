/// <reference types="vite/client" />

declare module '*.proto?raw' {
  const content: string;
  export default content;
}
