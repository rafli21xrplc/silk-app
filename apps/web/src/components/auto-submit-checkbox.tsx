'use client';

/** Kotak centang filter yang langsung menerapkan pilihannya (formulir GET induk dikirim ulang). */
export function AutoSubmitCheckbox({ name, value, defaultChecked, children }: { name: string; value: string; defaultChecked?: boolean; children: React.ReactNode }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-white px-4 text-[0.925rem] font-medium text-ink-soft shadow-soft transition-colors select-none hover:border-primary-200 hover:bg-primary-50 has-[:checked]:border-primary-200 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-800">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      {children}
    </label>
  );
}
