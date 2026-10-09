import { AdminClient } from "./AdminClient";

export const metadata = {
  title: "مدیریت | Farfaroo",
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <AdminClient />;
}
