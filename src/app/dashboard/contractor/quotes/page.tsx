import { redirect } from 'next/navigation';

export default function OldContractorQuotesRedirect() {
  redirect('/dashboard/contractor/offers');
}