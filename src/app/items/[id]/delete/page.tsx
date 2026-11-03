import Link from "next/link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ItemNotFound, loadItem } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { deleteItemAction } from "../../actions";

export const metadata = { title: "Delete item · Founder HQ" };

// Spec P12: deleting asks first, and Cancel keeps the item.
export default async function DeleteItemPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { item, failed } = await loadItem(id);
  if (!item) return <ItemNotFound failed={failed} />;
  return (
    <AppFrame current={item.project ? "/projects" : "/inbox"} project={item.project?.id}>
      <div className="page-head item-head">
        <h1>Delete “{item.title}”?</h1>
      </div>
      <p className="lede">This removes the item and its notes. Items waiting on it stop waiting. It can&apos;t be undone.</p>
      <div className="actions">
        <form action={deleteItemAction.bind(null, item.id)}>
          <button type="submit" className="btn btn-danger">
            Delete item
          </button>
        </form>
        <Link href={`/items/${item.id}`} className="btn">
          Cancel
        </Link>
      </div>
    </AppFrame>
  );
}
