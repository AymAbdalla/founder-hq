import { Frame } from "@/components/app-frame";

// Every signed-in page shares this frame. It is drawn once and stays on screen while you move
// between pages; each page's loading.tsx fills the page area until that page is ready.
// A signed-out visitor never sees it: each page sends them to sign-in first.
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <Frame>{children}</Frame>;
}
