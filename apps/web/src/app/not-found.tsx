import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/messages/id';

export default function NotFound() {
  return (
    <div className="container grid place-items-center py-16 text-center">
      <p className="m-0 text-[5rem] leading-none font-extrabold tracking-tighter text-primary-200">404</p>
      <h1 className="mt-4">{t.notFound.title}</h1>
      <p className="max-w-md text-muted">{t.notFound.body}</p>
      <Link href="/" className={buttonVariants({ variant: 'primary' })}>
        {t.common.back}
      </Link>
    </div>
  );
}
