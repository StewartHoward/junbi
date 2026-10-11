import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { clubFeeNow, planName } from "@/lib/plans";
import { todayISO } from "./classes";

type Row = {
  club_id: string; name: string; plan: string; founding: boolean; trial_ends_on: string | null;
  promo_code: string | null; discount_percent: number | null; discount_months: number | null;
  created_at: Date; onboarded_at: Date | null; owner_name: string | null; owner_email: string | null;
  sites: number; staff: number; students_active: number; students_total: number; students_new_30d: number;
  payment_provider: string | null; families_paying: number; collected_30d_pence: number; last_sign_in: Date | null; trial_iso: string | null;
};

/** Every club on Junbi, for the Junbi admin page. Only Junbi admins get past the check. */
export async function adminClubs() {
  await requireSuperAdmin();
  const rows = (await db().execute(sql`select *, to_char(trial_ends_on, 'YYYY-MM-DD') as trial_iso from admin_clubs()`)) as unknown as Row[];
  const today = todayISO();
  return rows.map((r) => {
    const fee = clubFeeNow({ plan: r.plan, founding: r.founding, trialEndsOn: r.trial_iso, discountPercent: r.discount_percent, discountMonths: r.discount_months }, today);
    return {
      id: r.club_id,
      name: r.name,
      plan: r.plan,
      planName: planName(r.plan),
      founding: r.founding,
      trialEndsOn: r.trial_iso,
      promoCode: r.promo_code,
      createdAt: new Date(r.created_at),
      setUp: Boolean(r.onboarded_at),
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      sites: r.sites,
      staff: r.staff,
      studentsActive: r.students_active,
      studentsTotal: r.students_total,
      studentsNew30d: r.students_new_30d,
      paymentProvider: r.payment_provider,
      familiesPaying: r.families_paying,
      collected30dPence: r.collected_30d_pence,
      lastSignIn: r.last_sign_in ? new Date(r.last_sign_in) : null,
      fee,
    };
  });
}
export type AdminClub = Awaited<ReturnType<typeof adminClubs>>[number];
