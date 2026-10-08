import { AdminClient } from "./AdminClient";

export const metadata = {
  title: "مدیریت | فرفرو",
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <AdminClient />;
}
