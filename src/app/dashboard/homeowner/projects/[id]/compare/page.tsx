import { redirect } from 'next/navigation';

interface Params {
  params: {
    id: string;
  };
}

export default function OldProjectCompareRedirect({ params }: Params) {
  redirect(`/dashboard/homeowner/compare?project=${params.id}`);
}