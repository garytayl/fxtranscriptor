import { SermonSeriesManager } from "@/components/admin/sermon-series-manager";

export default function AdminDashboardPage() {
  return (
    <div className="pt-[var(--navbar-offset)] px-4 sm:px-6 md:px-12 pb-12">
      <SermonSeriesManager />
    </div>
  );
}

