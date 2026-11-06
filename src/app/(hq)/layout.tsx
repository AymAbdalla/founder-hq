import { Frame } from "@/components/app-frame";
import { requireSignedIn } from "@/components/signed-in";

// Every signed-in page shares this frame. It is drawn once and stays on screen while you move
// between pages; only the page area changes. A signed-out visitor is sent to sign-in here,
// before the frame asks the database for their projects (each page checks again too).
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  await requireSignedIn();
  return <Frame>{children}</Frame>;
}
