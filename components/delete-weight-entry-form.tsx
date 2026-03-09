"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteWeightEntryAction } from "@/lib/actions/admin-actions";

interface DeleteWeightEntryFormProps {
  entryId: string;
  userName: string;
  entryDate: string;
  valueLabel: string;
}

export function DeleteWeightEntryForm({ entryId, userName, entryDate, valueLabel }: DeleteWeightEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (!window.confirm(`Delete ${userName}'s ${valueLabel} entry from ${entryDate}?`)) {
          return;
        }

        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          await deleteWeightEntryAction(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-full bg-[#8f4a36] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f3526] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={isPending}
      >
        {isPending ? "Deleting..." : "Delete entry"}
      </button>
    </form>
  );
}
