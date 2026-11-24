import { PageHeader } from '@/components/ui';
import CalendarView from './CalendarView';

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" sub="Bookings and pending follow-ups. Click any item to open it." />
      <CalendarView followups />
    </>
  );
}
