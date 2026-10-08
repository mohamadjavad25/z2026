import { AdminClient } from "./AdminClient";

export const metadata = {
  title: "مدیریت | frfro",
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <AdminClient />;
}
