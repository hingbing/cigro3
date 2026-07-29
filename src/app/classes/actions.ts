"use server";

import { z } from "zod";
import { requireRole } from "@/server/authorization/guards";
import { createReservation } from "@/server/bookings/member-reservations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const schema = z.object({
  occurrenceId: z.string().uuid(),
  passId: z.string().uuid(),
});

export type ReservationActionState = { error?: string };
export async function reserveAction(_: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = schema.safeParse({
    occurrenceId: formData.get("occurrenceId"),
    passId: formData.get("passId"),
  });

  if (!parsed.success) {
    return { error: "수업과 이용권을 선택해 주세요." };
  }

  const session = await requireRole(["MEMBER"]);

  if (!session.ok) {
    return { error: "회원만 예약할 수 있습니다." };
  }

  const result = await createReservation({
    memberId: session.value.userId,
    ...parsed.data,
  });
  if (!result.ok) {
    const message = { ALREADY_BOOKED: "이미 예약한 수업입니다.", CLASS_FULL: "수업 정원이 모두 찼습니다.", PASS_UNAVAILABLE: "사용 가능한 이용권이 없습니다.", BOOKING_CLOSED: "예약 가능한 시간이 아닙니다.", FORBIDDEN: "예약 권한이 없습니다." }[result.error];
    return { error: message };
  }
  revalidatePath("/classes"); revalidatePath("/reservations"); redirect("/classes");
}
