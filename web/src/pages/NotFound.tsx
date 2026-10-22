import { useNavigate } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/feedback';

export default function NotFoundPage() {
  const nav = useNavigate();
  return <EmptyState className="pt-20" icon={<MapPinOff className="size-7" />} title="This station doesn't exist" body="The page you're looking for isn't on our route map." action={<Button onClick={() => nav('/')}>Back to home</Button>} />;
}
