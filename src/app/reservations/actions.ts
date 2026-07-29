"use server";

import { z } from "zod";
import { requireRole } from "@/server/authorization/guards";
import { cancelReservation } from "@/server/bookings/member-reservations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CancellationActionState = { error?: string };
export async function cancelAction(_: CancellationActionState, formData: FormData): Promise<CancellationActionState> {
  const parsed = z
    .object({
      reservationId: z.string().uuid(),
    })
    .safeParse({
      reservationId: formData.get("reservationId"),
    });

  if (!parsed.success) {
    return { error: "유효하지 않은 예약입니다." };
  }

  const session = await requireRole(["MEMBER"]);

  if (!session.ok) {
    return { error: "회원만 예약을 취소할 수 있습니다." };
  }

  const result = await cancelReservation({
    memberId: session.value.userId,
    reservationId: parsed.data.reservationId,
  });
  if (!result.ok) return { error: result.error === "CANCELLATION_CLOSED" ? "취소 가능 시간이 지났습니다." : "예약을 취소할 수 없습니다." };
  revalidatePath("/classes"); revalidatePath("/reservations"); redirect("/reservations");
}
