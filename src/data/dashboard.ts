import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { withClub } from "@/db/client";
import { assertCan, can, type Actor } from "@/auth/permissions";

/** The period buttons on the dashboard, and how the attendance chart is split up for each. */
export const PERIODS = {
  "7d": { days: 7, label: "7 days", unit: "day", buckets: 7 },
  "30d": { days: 30, label: "30 days", unit: "day", buckets: 30 },
  "3m": { days: 91, label: "3 months", unit: "week", buckets: 13 },
  "12m": { days: 365, label: "12 months", unit: "month", buckets: 12 },
} as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = "3m";
export const periodKey = (v: string | undefined): PeriodKey => (v && v in PERIODS ? (v as PeriodKey) : DEFAULT_PERIOD);

const isId = (v: string | undefined | null): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

/**
 * SQL condition limiting a site column to the chosen venue, or to the sites this person covers.
 * `allowNull` is for leads, which may not have a site yet.
 */
function siteCond(actor: Actor, siteId: string | undefined, col: string, allowNull = false): SQL {
  const c = sql.raw(col);
  if (isId(siteId) && (actor.sites === "all" || actor.sites.includes(siteId))) return sql`${c} = ${siteId}`;
  if (actor.sites === "all") return sql`true`;
  if (!actor.sites.length) return allowNull ? sql`${c} is null` : sql`false`;
  const list = sql.join(actor.sites.map((id) => sql`${id}::uuid`), sql`, `);
  return allowNull ? sql`(${c} is null or ${c} in (${list}))` : sql`${c} in (${list})`;
}

/** Active students with no class in the last 7 days (and who joined more than a week ago). */
const absentWhere = (S: SQL) => sql`
  s.status = 'active' and s.joined_on <= current_date - 7 and ${S}
  and not exists (
    select 1 from attendance a join class_sessions cs on cs.id = a.session_id
    where a.student_id = s.id and cs.starts_at > now() - interval '7 days')`;

const expectedMonthly = (S: SQL) => sql`
  (select coalesce(sum(case p.interval when 'monthly' then p.amount_pence when 'annual' then p.amount_pence / 12.0 else p.amount_pence * 3 / 12.0 end), 0)::int
     from memberships m join plans p on p.id = m.plan_id join students s on s.id = m.student_id
     where m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date) and s.status = 'active' and ${S})`;

type Row = Record<string, unknown>;
const rows = <T>(r: unknown) => r as unknown as T[];

export async function dashboardStats(actor: Actor, opts: { siteId?: string; period?: string } = {}) {
  const key = periodKey(opts.period);
  const P = PERIODS[key];
  const S = siteCond(actor, opts.siteId, "s.site_id");
  const C = siteCond(actor, opts.siteId, "c.site_id");
  const L = siteCond(actor, opts.siteId, "l.site_id", true);
  const N = P.days;
  const people = can(actor, "students.view");
  const money = can(actor, "payments.view");

  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [k] = rows<{
      active: number; new_students: number; paying: number; joined: number; leaving: number;
      att: number; att_prev: number; att_sessions: number; absent: number; expected: number;
      trials: number; trials_prev: number; came: number; converted: number; days_to_join: number | null; leads_new: number; graded: number;
    }>(await tx.execute(sql`
      select
        (select count(*)::int from students s where s.status = 'active' and ${S}) as active,
        (select count(*)::int from students s where s.status in ('active', 'trial') and s.joined_on > current_date - ${N}::int and ${S}) as new_students,
        (select count(distinct m.student_id)::int from memberships m join students s on s.id = m.student_id
           where m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date) and s.status = 'active' and ${S}) as paying,
        (select count(*)::int from memberships m join students s on s.id = m.student_id
           where m.status <> 'cancelled' and m.starts_on > current_date - ${N}::int and ${S}) as joined,
        (select count(*)::int from memberships m join students s on s.id = m.student_id
           where m.status = 'active' and m.ends_on >= current_date and ${S}) as leaving,
        (select count(*)::int from attendance a join class_sessions cs on cs.id = a.session_id join classes c on c.id = cs.class_id
           where cs.starts_at > now() - make_interval(days => ${N}::int) and cs.starts_at <= now() and ${C}) as att,
        (select count(*)::int from attendance a join class_sessions cs on cs.id = a.session_id join classes c on c.id = cs.class_id
           where cs.starts_at > now() - make_interval(days => ${2 * N}::int) and cs.starts_at <= now() - make_interval(days => ${N}::int) and ${C}) as att_prev,
        (select count(distinct a.session_id)::int from attendance a join class_sessions cs on cs.id = a.session_id join classes c on c.id = cs.class_id
           where cs.starts_at > now() - make_interval(days => ${N}::int) and cs.starts_at <= now() and ${C}) as att_sessions,
        (select count(*)::int from students s where ${absentWhere(S)}) as absent,
        ${expectedMonthly(S)} as expected,
        (select count(*)::int from leads l where l.session_at is not null and l.created_at > now() - make_interval(days => ${N}::int) and ${L}) as trials,
        (select count(*)::int from leads l where l.session_at is not null and l.created_at > now() - make_interval(days => ${2 * N}::int)
           and l.created_at <= now() - make_interval(days => ${N}::int) and ${L}) as trials_prev,
        (select count(*)::int from leads l where l.created_at > now() - make_interval(days => ${N}::int) and l.status in ('attended', 'converted') and ${L}) as came,
        (select count(*)::int from leads l where l.created_at > now() - make_interval(days => ${N}::int) and l.status = 'converted' and ${L}) as converted,
        (select round(avg(extract(epoch from (l.converted_at - l.created_at)) / 86400))::int from leads l
           where l.converted_at > now() - make_interval(days => ${N}::int) and ${L}) as days_to_join,
        (select count(*)::int from leads l where l.status = 'new' and ${L}) as leads_new,
        (select count(*)::int from grading_results gr join students s on s.id = gr.student_id
           where gr.outcome <> 'fail' and gr.graded_on > current_date - ${N}::int and ${S}) as graded
    `));

    // Attendance chart: days for a week or month, weeks for 3 months, months for a year.
    const unit = sql.raw(`'${P.unit}'`);
    const back = sql.raw(`interval '${P.buckets - 1} ${P.unit}'`);
    const step = sql.raw(`interval '1 ${P.unit}'`);
    const chart = rows<{ start: string; n: number }>(await tx.execute(sql`
      with b as (
        select g as start, g + ${step} as stop
        from generate_series(date_trunc(${unit}, now() at time zone 'Europe/London') - ${back}, date_trunc(${unit}, now() at time zone 'Europe/London'), ${step}) g
      )
      select to_char(b.start, 'YYYY-MM-DD') as start, count(x.id)::int as n
      from b left join (
        select a.id, cs.starts_at at time zone 'Europe/London' as at
        from attendance a join class_sessions cs on cs.id = a.session_id join classes c on c.id = cs.class_id
        where ${C}
      ) x on x.at >= b.start and x.at < b.stop
      group by b.start order by b.start
    `));

    const belts = rows<{ name: string; belt_colour: string; n: number }>(await tx.execute(sql`
      select g.name, g.belt_colour, count(*)::int as n from (
        select distinct on (gr.student_id) gr.student_id, gr.grade_id
        from grading_results gr join grades g2 on g2.id = gr.grade_id join students s on s.id = gr.student_id
        where gr.outcome <> 'fail' and s.status = 'active' and ${S}
        order by gr.student_id, gr.graded_on desc, g2.sort_order desc
      ) cur join grades g on g.id = cur.grade_id
      group by g.id, g.name, g.belt_colour, g.discipline, g.sort_order
      order by g.discipline, g.sort_order
    `));

    const absent = people
      ? rows<{ id: string; first_name: string; last_name: string; last: string | null }>(await tx.execute(sql`
          select s.id, s.first_name, s.last_name,
            (select to_char(max(cs.starts_at at time zone 'Europe/London'), 'YYYY-MM-DD') from attendance a join class_sessions cs on cs.id = a.session_id where a.student_id = s.id) as last
          from students s where ${absentWhere(S)}
          order by last desc nulls last, s.last_name limit 6
        `))
      : [];

    let plan: null | { paid: number; processing: number; toFix: number; collected: number; onTheWay: number; outstanding: number } = null;
    if (money) {
      const [p] = rows<Row>(await tx.execute(sql`
        with month as (select date_trunc('month', (now() at time zone 'Europe/London'))::date as start)
        select
          (select count(*)::int from payments where status in ('confirmed', 'paid_out') and charge_date > current_date - ${N}::int) as paid,
          (select count(*)::int from payments where status in ('pending', 'submitted') and charge_date > current_date - ${N}::int) as processing,
          (select count(*)::int from payments where status in ('failed', 'retrying', 'charged_back') and charge_date > current_date - ${N}::int) as to_fix,
          (select coalesce(sum(amount_pence), 0)::int from payments, month where status in ('confirmed', 'paid_out') and charge_date >= month.start) as collected,
          (select coalesce(sum(amount_pence), 0)::int from payments, month where status in ('pending', 'submitted') and charge_date >= month.start) as on_the_way,
          (select coalesce(sum(amount_pence), 0)::int from payments where status in ('failed', 'retrying', 'charged_back') and charge_date >= current_date - 90) as outstanding
      `));
      plan = {
        paid: Number(p.paid), processing: Number(p.processing), toFix: Number(p.to_fix),
        collected: Number(p.collected), onTheWay: Number(p.on_the_way), outstanding: Number(p.outstanding),
      };
    }

    return {
      period: key,
      unit: P.unit,
      activeStudents: k.active,
      newStudents: k.new_students,
      membersPaying: k.paying,
      joined: k.joined,
      leaving: k.leaving,
      attendance: k.att,
      attendancePrev: k.att_prev,
      perClass: k.att_sessions ? Math.round(k.att / k.att_sessions) : 0,
      absentCount: k.absent,
      monthlyPence: money ? k.expected : null,
      trials: k.trials,
      trialsPrev: k.trials_prev,
      came: k.came,
      converted: k.converted,
      daysToJoin: k.days_to_join,
      newLeads: k.leads_new,
      graded: k.graded,
      chart,
      belts,
      absent: absent.map((a) => ({ id: a.id, name: `${a.first_name} ${a.last_name}`, last: a.last })),
      plan,
    };
  });
}

/** The numbers and short lists on the Students page before anyone is picked. */
export async function studentsSummary(actor: Actor) {
  assertCan(actor, "students.view");
  const S = siteCond(actor, undefined, "s.site_id");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [k] = rows<{ active: number; new_students: number; no_plan: number; absent: number }>(await tx.execute(sql`
      select
        (select count(*)::int from students s where s.status = 'active' and ${S}) as active,
        (select count(*)::int from students s where s.status in ('active', 'trial') and s.joined_on > current_date - 91 and ${S}) as new_students,
        (select count(*)::int from students s where s.status = 'active' and ${S}
           and not exists (select 1 from memberships m where m.student_id = s.id and m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date))) as no_plan,
        (select count(*)::int from students s where ${absentWhere(S)}) as absent
    `));
    const noPlan = rows<{ id: string; first_name: string; last_name: string; joined_on: string }>(await tx.execute(sql`
      select s.id, s.first_name, s.last_name, to_char(s.joined_on, 'YYYY-MM-DD') as joined_on from students s
      where s.status = 'active' and ${S}
        and not exists (select 1 from memberships m where m.student_id = s.id and m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date))
      order by s.joined_on desc limit 4
    `));
    const recent = rows<{ id: string; first_name: string; last_name: string; joined_on: string; site: string }>(await tx.execute(sql`
      select s.id, s.first_name, s.last_name, to_char(s.joined_on, 'YYYY-MM-DD') as joined_on, si.name as site
      from students s join sites si on si.id = s.site_id
      where s.status in ('active', 'trial') and ${S}
      order by s.joined_on desc, s.created_at desc limit 5
    `));
    return {
      active: k.active,
      newStudents: k.new_students,
      noPlanCount: k.no_plan,
      absentCount: k.absent,
      noPlan: noPlan.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, joinedOn: r.joined_on })),
      recent: recent.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, joinedOn: r.joined_on, site: r.site })),
    };
  });
}
