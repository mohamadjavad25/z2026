import { AdminClient } from "./AdminClient";

export const metadata = {
  title: "مدیریت | Frfru",
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <AdminClient />;
}
